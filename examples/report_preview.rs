use chrono::{Duration, NaiveDate};
use std::path::Path;

use accuchek::{
    export::PdfExporter,
    stats::ExportStatistics,
    storage::StoredReading,
    units::{GlucoseUnit, Thresholds},
};

fn main() -> Result<(), String> {
    let values = [
        92, 107, 119, 135, 164, 128, 102, 88, 142, 176, 151, 124, 98, 111, 203, 156, 132, 74, 95,
        121, 146, 188, 114, 84, 105, 139, 167, 126,
    ];
    let start = NaiveDate::from_ymd_opt(2026, 8, 17).expect("valid preview date");
    let readings = values
        .into_iter()
        .enumerate()
        .map(|(index, mg_dl)| StoredReading {
            id: index as i64 + 1,
            epoch: index as i64,
            timestamp: format!(
                "{} {:02}:15:00",
                start + Duration::days(index as i64),
                [7, 12, 18, 22][index % 4]
            ),
            mg_dl,
            mmol_l: f64::from(mg_dl) / 18.0,
            raw_value: mg_dl,
            status: 0,
            range_state: "normal".to_owned(),
            device_key: "preview".to_owned(),
            occurrence: 0,
            note: None,
            tags: Some(["Fasting", "Before meal", "After meal", "Bedtime"][index % 4].to_owned()),
            imported_at: "2026-09-13".to_owned(),
            meal_context: None,
            meal_event_id: None,
            quality_note: None,
        })
        .collect::<Vec<_>>();
    let thresholds = Thresholds::default();
    let stats = ExportStatistics::generate(&readings, thresholds);
    let path = Path::new("output/pdf/doctor-report-preview.pdf");
    std::fs::create_dir_all(path.parent().expect("output directory"))
        .map_err(|error| error.to_string())?;
    PdfExporter::new(&readings, &stats, thresholds, GlucoseUnit::MgDl).export(path)
}
