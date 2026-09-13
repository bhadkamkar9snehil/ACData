use accuchek::config::{config_file_path, default_database_path, default_export_dir, Config};
use accuchek::analysis::filter_recent;
use accuchek::export::PdfExporter;
use accuchek::stats::ExportStatistics;
use accuchek::storage::{InsulinDose, MealEvent, MedicationChange, Storage};
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContextDto {
    meals: Vec<MealEvent>,
    medication_changes: Vec<MedicationChange>,
    insulin_doses: Vec<InsulinDose>,
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
                    meal: row.meal_context.or(row.tags),
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
fn export_report(days: Option<i64>, unit: String) -> Result<String, String> {
    let storage = Storage::new(default_database_path()).map_err(|error| error.to_string())?;
    let readings = filter_recent(&storage
        .get_all_readings()
        .map_err(|error| error.to_string())?, days);
    let thresholds = Thresholds::default();
    let stats = ExportStatistics::generate(&readings, thresholds);
    let path = default_export_dir().join("AccuChek-Local-Report.pdf");
    let glucose_unit = if unit == "mmol" { GlucoseUnit::MmolL } else { GlucoseUnit::MgDl };
    PdfExporter::new(&readings, &stats, thresholds, glucose_unit).export(&path)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn get_context() -> Result<ContextDto, String> {
    let storage = Storage::new(default_database_path()).map_err(|error| error.to_string())?;
    Ok(ContextDto {
        meals: storage.get_meal_events().map_err(|error| error.to_string())?,
        medication_changes: storage.get_medication_changes().map_err(|error| error.to_string())?,
        insulin_doses: storage.get_insulin_doses().map_err(|error| error.to_string())?,
    })
}

#[tauri::command]
fn add_medication_change(change: MedicationChange) -> Result<i64, String> {
    Storage::new(default_database_path())
        .and_then(|storage| storage.add_medication_change(&change))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn add_meal_event(event: MealEvent) -> Result<i64, String> {
    Storage::new(default_database_path())
        .and_then(|storage| storage.add_meal_event(&event))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn add_insulin_dose(dose: InsulinDose) -> Result<i64, String> {
    Storage::new(default_database_path())
        .and_then(|storage| storage.add_insulin_dose(&dose))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_reading_context(id: i64, context: Option<String>) -> Result<(), String> {
    let storage = Storage::new(default_database_path()).map_err(|error| error.to_string())?;
    let updated = storage.set_reading_context(id, context.as_deref(), None).map_err(|error| error.to_string())?;
    if updated == 1 { Ok(()) } else { Err(format!("Reading {id} was not found")) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_readings,
            sync_meter,
            export_report
            ,get_context, add_medication_change, add_meal_event, add_insulin_dose, set_reading_context
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AccuChek Local");
}
