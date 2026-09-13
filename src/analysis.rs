use std::collections::BTreeMap;

use chrono::{NaiveDateTime, Timelike};
use serde::{Deserialize, Serialize};

use crate::storage::StoredReading;

pub const ANALYSIS_SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucketSummary {
    pub label: String,
    pub count: usize,
    pub median_mg_dl: Option<f64>,
    pub minimum_mg_dl: Option<u16>,
    pub maximum_mg_dl: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlierFinding {
    pub reading_id: i64,
    pub timestamp: String,
    pub mg_dl: u16,
    pub robust_z: f64,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisReport {
    pub schema_version: String,
    pub sample_count: usize,
    pub median_mg_dl: Option<f64>,
    pub time_of_day: Vec<BucketSummary>,
    pub meal_context: Vec<BucketSummary>,
    pub statistical_outliers: Vec<OutlierFinding>,
    pub limitations: Vec<String>,
}

pub fn analyze(readings: &[StoredReading]) -> AnalysisReport {
    let time_groups = group(readings, |reading| {
        time_bucket(&reading.timestamp).to_owned()
    });
    let meal_groups = group(readings, |reading| {
        reading
            .meal_context
            .clone()
            .unwrap_or_else(|| "Unclassified".to_owned())
    });
    AnalysisReport {
        schema_version: ANALYSIS_SCHEMA_VERSION.to_owned(),
        sample_count: readings.len(),
        median_mg_dl: median(&readings.iter().map(|r| r.mg_dl).collect::<Vec<_>>()),
        time_of_day: summarize_groups(time_groups),
        meal_context: summarize_groups(meal_groups),
        statistical_outliers: detect_outliers(readings),
        limitations: vec![
            "Finger-stick readings are spot samples, not continuous glucose coverage.".to_owned(),
            "Statistical outliers are retained and may be clinically meaningful.".to_owned(),
            "Treatment comparisons show association, not causation or dosing advice.".to_owned(),
        ],
    }
}

fn group<F>(readings: &[StoredReading], key: F) -> BTreeMap<String, Vec<&StoredReading>>
where
    F: Fn(&StoredReading) -> String,
{
    let mut groups = BTreeMap::new();
    for reading in readings {
        groups
            .entry(key(reading))
            .or_insert_with(Vec::new)
            .push(reading);
    }
    groups
}

fn summarize_groups(groups: BTreeMap<String, Vec<&StoredReading>>) -> Vec<BucketSummary> {
    groups
        .into_iter()
        .map(|(label, rows)| {
            let values = rows.iter().map(|row| row.mg_dl).collect::<Vec<_>>();
            BucketSummary {
                label,
                count: values.len(),
                median_mg_dl: median(&values),
                minimum_mg_dl: values.iter().min().copied(),
                maximum_mg_dl: values.iter().max().copied(),
            }
        })
        .collect()
}

fn time_bucket(timestamp: &str) -> &'static str {
    let hour = NaiveDateTime::parse_from_str(timestamp, "%Y-%m-%d %H:%M:%S")
        .map(|value| value.hour())
        .unwrap_or(0);
    match hour {
        0..=5 => "Overnight",
        6..=10 => "Morning",
        11..=15 => "Midday",
        16..=20 => "Evening",
        _ => "Night",
    }
}

fn detect_outliers(readings: &[StoredReading]) -> Vec<OutlierFinding> {
    let values = readings.iter().map(|r| r.mg_dl).collect::<Vec<_>>();
    if values.len() < 7 {
        return Vec::new();
    }
    let center = median(&values).unwrap_or_default();
    let deviations = values
        .iter()
        .map(|value| (f64::from(*value) - center).abs())
        .collect::<Vec<_>>();
    let mad = median_f64(&deviations).unwrap_or_default();
    if mad == 0.0 {
        return Vec::new();
    }
    readings
        .iter()
        .filter_map(|reading| {
            let robust_z = 0.6745 * (f64::from(reading.mg_dl) - center) / mad;
            (robust_z.abs() > 3.5).then(|| OutlierFinding {
                reading_id: reading.id,
                timestamp: reading.timestamp.clone(),
                mg_dl: reading.mg_dl,
                robust_z,
                context: reading
                    .meal_context
                    .clone()
                    .unwrap_or_else(|| time_bucket(&reading.timestamp).to_owned()),
            })
        })
        .collect()
}

fn median(values: &[u16]) -> Option<f64> {
    median_f64(
        &values
            .iter()
            .map(|value| f64::from(*value))
            .collect::<Vec<_>>(),
    )
}

fn median_f64(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let middle = sorted.len() / 2;
    Some(if sorted.len().is_multiple_of(2) {
        (sorted[middle - 1] + sorted[middle]) / 2.0
    } else {
        sorted[middle]
    })
}

#[cfg(test)]
mod tests {
    use super::median;

    #[test]
    fn median_supports_even_and_odd_samples() {
        assert_eq!(median(&[90, 100, 110]), Some(100.0));
        assert_eq!(median(&[90, 100, 110, 120]), Some(105.0));
        assert_eq!(median(&[]), None);
    }
}
