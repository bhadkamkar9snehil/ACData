//! One-shot meter synchronization for CLI and desktop callers.

use crate::config::Config;
use crate::device::{find_and_download_accuchek, GlucoseReading};
use crate::error::AccuChekError;
use crate::storage::Storage;

/// Result of downloading and persisting one meter session.
#[derive(Debug)]
pub struct SyncSummary {
    pub readings: Vec<GlucoseReading>,
    pub imported_count: usize,
    pub total_count: i64,
    pub database_path: String,
}

impl SyncSummary {
    pub fn duplicate_count(&self) -> usize {
        self.readings.len().saturating_sub(self.imported_count)
    }
}

/// Download all available readings and persist them in the local database.
pub fn sync_device(
    config: &Config,
    database_path: &str,
    device_index: Option<usize>,
) -> Result<SyncSummary, AccuChekError> {
    let context = rusb::Context::new()?;
    let download = find_and_download_accuchek(&context, config, device_index)?;
    let storage = Storage::new(database_path)?;
    storage.upsert_device(&download.device)?;
    let imported_count = storage.import_readings(&download.readings)?;
    let total_count = storage.count()?;

    Ok(SyncSummary {
        readings: download.readings,
        imported_count,
        total_count,
        database_path: database_path.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use crate::device::{GlucoseReading, ReadingRange};

    use super::SyncSummary;

    fn reading(id: usize) -> GlucoseReading {
        GlucoseReading {
            id,
            epoch: id as i64,
            timestamp: "2026-09-13T12:00:00".to_string(),
            mg_dl: 100,
            mmol_l: 5.6,
            raw_value: 100,
            status: 0,
            range_state: ReadingRange::Normal,
            device_key: "test-meter".to_string(),
        }
    }

    #[test]
    fn sync_summary_reports_duplicate_count() {
        let summary = SyncSummary {
            readings: vec![reading(1), reading(2), reading(3)],
            imported_count: 2,
            total_count: 10,
            database_path: "accuchek.db".to_string(),
        };

        assert_eq!(summary.duplicate_count(), 1);
    }
}
