impl Storage {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;",
        )?;
        Self::initialize_schema(&conn)?;
        Ok(Self { conn })
    }

    fn initialize_schema(conn: &Connection) -> Result<()> {
        let table_exists: i64 = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='readings')",
            [],
            |row| row.get(0),
        )?;

        if table_exists == 0 {
            Self::create_v3_schema(conn)?;
            return Ok(());
        }

        let has_raw_value = Self::column_exists(conn, "readings", "raw_value")?;

        if !has_raw_value {
            conn.execute_batch(
                "BEGIN IMMEDIATE;
                 DROP INDEX IF EXISTS idx_readings_epoch;
                 DROP INDEX IF EXISTS idx_readings_mg_dl;
                 DROP INDEX IF EXISTS idx_readings_timestamp;
                 ALTER TABLE readings RENAME TO readings_v1_backup;

                 CREATE TABLE readings (
                    id INTEGER PRIMARY KEY,
                    epoch INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    mg_dl INTEGER NOT NULL,
                    mmol_l REAL NOT NULL,
                    raw_value INTEGER NOT NULL,
                    status INTEGER NOT NULL DEFAULT 0,
                    range_state TEXT NOT NULL DEFAULT 'normal',
                    device_key TEXT NOT NULL DEFAULT 'legacy',
                    occurrence INTEGER NOT NULL DEFAULT 0,
                    note TEXT,
                    tags TEXT,
                    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(device_key, timestamp, raw_value, status, occurrence)
                 );

                 INSERT INTO readings (
                    id, epoch, timestamp, mg_dl, mmol_l, raw_value, status,
                    range_state, device_key, occurrence, note, tags, imported_at
                 )
                 SELECT
                    id, epoch, timestamp, mg_dl, mmol_l, mg_dl, 0,
                    'normal', 'legacy', 0, note, tags, imported_at
                 FROM readings_v1_backup;

                 DROP TABLE readings_v1_backup;
                 CREATE INDEX idx_readings_epoch ON readings(epoch);
                 CREATE INDEX idx_readings_mg_dl ON readings(mg_dl);
                 CREATE INDEX idx_readings_timestamp ON readings(timestamp);
                 CREATE INDEX idx_readings_device_time ON readings(device_key, timestamp);
                 CREATE INDEX idx_readings_status ON readings(status);

                 CREATE TABLE IF NOT EXISTS devices (
                    device_key TEXT PRIMARY KEY,
                    vendor_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    manufacturer TEXT NOT NULL,
                    usb_product TEXT NOT NULL,
                    usb_serial TEXT,
                    model_number INTEGER,
                    model_name TEXT NOT NULL,
                    serial_number TEXT,
                    meter_time TEXT,
                    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );
                 PRAGMA user_version = 2;
                 COMMIT;",
            )?;
        } else {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS devices (
                    device_key TEXT PRIMARY KEY,
                    vendor_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    manufacturer TEXT NOT NULL,
                    usb_product TEXT NOT NULL,
                    usb_serial TEXT,
                    model_number INTEGER,
                    model_name TEXT NOT NULL,
                    serial_number TEXT,
                    meter_time TEXT,
                    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );
                 CREATE INDEX IF NOT EXISTS idx_readings_device_time ON readings(device_key, timestamp);
                 CREATE INDEX IF NOT EXISTS idx_readings_status ON readings(status);
                 PRAGMA user_version = 2;",
            )?;
        }

        Self::migrate_to_v3(conn)?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version != SCHEMA_VERSION {
            return Err(rusqlite::Error::InvalidQuery);
        }
        Ok(())
    }

    fn create_v3_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "CREATE TABLE readings (
                id INTEGER PRIMARY KEY,
                epoch INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                mg_dl INTEGER NOT NULL,
                mmol_l REAL NOT NULL,
                raw_value INTEGER NOT NULL,
                status INTEGER NOT NULL DEFAULT 0,
                range_state TEXT NOT NULL DEFAULT 'normal',
                device_key TEXT NOT NULL,
                occurrence INTEGER NOT NULL DEFAULT 0,
                note TEXT,
                tags TEXT,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                meal_context TEXT,
                meal_event_id INTEGER REFERENCES meal_events(id),
                quality_note TEXT,
                UNIQUE(device_key, timestamp, raw_value, status, occurrence)
             );
             CREATE INDEX idx_readings_epoch ON readings(epoch);
             CREATE INDEX idx_readings_mg_dl ON readings(mg_dl);
             CREATE INDEX idx_readings_timestamp ON readings(timestamp);
             CREATE INDEX idx_readings_device_time ON readings(device_key, timestamp);
             CREATE INDEX idx_readings_status ON readings(status);

             CREATE TABLE devices (
                device_key TEXT PRIMARY KEY,
                vendor_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                manufacturer TEXT NOT NULL,
                usb_product TEXT NOT NULL,
                usb_serial TEXT,
                model_number INTEGER,
                model_name TEXT NOT NULL,
                serial_number TEXT,
                meter_time TEXT,
                first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE meal_events (
                id INTEGER PRIMARY KEY, occurred_at TEXT NOT NULL, meal_type TEXT NOT NULL,
                description TEXT, carbs_grams REAL, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE medication_changes (
                id INTEGER PRIMARY KEY, effective_at TEXT NOT NULL, medication_name TEXT NOT NULL,
                previous_dose REAL, new_dose REAL, dose_unit TEXT, frequency TEXT,
                reason TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE insulin_doses (
                id INTEGER PRIMARY KEY, taken_at TEXT NOT NULL, insulin_name TEXT NOT NULL,
                insulin_type TEXT NOT NULL, units REAL NOT NULL CHECK(units > 0),
                meal_event_id INTEGER REFERENCES meal_events(id), notes TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE INDEX idx_meal_events_time ON meal_events(occurred_at);
             CREATE INDEX idx_medication_changes_time ON medication_changes(effective_at);
             CREATE INDEX idx_insulin_doses_time ON insulin_doses(taken_at);
             PRAGMA user_version = 3;",
        )?;
        Ok(())
    }

    fn migrate_to_v3(conn: &Connection) -> Result<()> {
        let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version >= 3 {
            return Ok(());
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS meal_events (
                id INTEGER PRIMARY KEY, occurred_at TEXT NOT NULL, meal_type TEXT NOT NULL,
                description TEXT, carbs_grams REAL, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS medication_changes (
                id INTEGER PRIMARY KEY, effective_at TEXT NOT NULL, medication_name TEXT NOT NULL,
                previous_dose REAL, new_dose REAL, dose_unit TEXT, frequency TEXT,
                reason TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS insulin_doses (
                id INTEGER PRIMARY KEY, taken_at TEXT NOT NULL, insulin_name TEXT NOT NULL,
                insulin_type TEXT NOT NULL, units REAL NOT NULL CHECK(units > 0),
                meal_event_id INTEGER REFERENCES meal_events(id), notes TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );",
        )?;

        for (column, definition) in [
            ("meal_context", "meal_context TEXT"),
            (
                "meal_event_id",
                "meal_event_id INTEGER REFERENCES meal_events(id)",
            ),
            ("quality_note", "quality_note TEXT"),
        ] {
            if !Self::column_exists(conn, "readings", column)? {
                conn.execute(&format!("ALTER TABLE readings ADD COLUMN {definition}"), [])?;
            }
        }

        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_meal_events_time ON meal_events(occurred_at);
             CREATE INDEX IF NOT EXISTS idx_medication_changes_time ON medication_changes(effective_at);
             CREATE INDEX IF NOT EXISTS idx_insulin_doses_time ON insulin_doses(taken_at);
             PRAGMA user_version = 3;",
        )?;
        Ok(())
    }

    fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
        for existing in columns {
            if existing? == column {
                return Ok(true);
            }
        }
        Ok(false)
    }
}
