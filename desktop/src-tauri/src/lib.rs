use accuchek::config::{config_file_path, default_database_path, default_export_dir, Config};
use accuchek::export::PdfExporter;
use accuchek::stats::ExportStatistics;
use accuchek::storage::Storage;
use accuchek::sync::sync_device;
use accuchek::units::{GlucoseUnit, Thresholds};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadingDto {
    id: i64,
    timestamp: String,
    mg_dl: u16,
    status: u16,
    meal: Option<String>,
}

fn config() -> Config {
    Config::load(config_file_path()).unwrap_or_default()
}

#[tauri::command]
fn get_readings() -> Result<Vec<ReadingDto>, String> {
    let storage = Storage::new(default_database_path()).map_err(|error| error.to_string())?;
    storage
        .get_all_readings()
        .map_err(|error| error.to_string())
        .map(|rows| {
            rows.into_iter()
                .map(|row| ReadingDto {
                    id: row.id,
                    timestamp: row.timestamp,
                    mg_dl: row.mg_dl,
                    status: row.status,
                    meal: row.tags,
                })
                .collect()
        })
}

#[tauri::command]
fn sync_meter() -> Result<usize, String> {
    sync_device(&config(), &default_database_path().to_string_lossy(), None)
        .map(|summary| summary.imported_count)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_report() -> Result<String, String> {
    let storage = Storage::new(default_database_path()).map_err(|error| error.to_string())?;
    let readings = storage
        .get_all_readings()
        .map_err(|error| error.to_string())?;
    let thresholds = Thresholds::default();
    let stats = ExportStatistics::generate(&readings, thresholds);
    let path = default_export_dir().join("AccuChek-Local-Report.pdf");
    PdfExporter::new(&readings, &stats, thresholds, GlucoseUnit::MgDl).export(&path)?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_readings,
            sync_meter,
            export_report
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AccuChek Local");
}
