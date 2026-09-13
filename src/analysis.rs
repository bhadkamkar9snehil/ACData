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
    pub average_mg_dl: Option<f64>,
    pub standard_deviation_mg_dl: Option<f64>,
    pub sampled_in_range_percent: Option<f64>,
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
    pub trend_changes: Vec<TrendChange>,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendChange {
    pub changed_at: String,
    pub direction: String,
    pub before_average_mg_dl: f64,
    pub after_average_mg_dl: f64,
    pub difference_mg_dl: f64,
    pub before_count: usize,
    pub after_count: usize,
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
        trend_changes: detect_trend_changes(readings),
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
                average_mg_dl: average(&values),
                standard_deviation_mg_dl: standard_deviation(&values),
                sampled_in_range_percent: (!values.is_empty()).then(|| {
                    100.0
                        * values
                            .iter()
                            .filter(|value| (70..=180).contains(*value))
                            .count() as f64
                        / values.len() as f64
                }),
            }
        })
        .collect()
}

pub fn detect_trend_changes(readings: &[StoredReading]) -> Vec<TrendChange> {
    const MIN_SIDE: usize = 4;
    const MIN_CHANGE_MG_DL: f64 = 20.0;
    if readings.len() < MIN_SIDE * 2 {
        return Vec::new();
    }
    let mut ordered = readings.iter().collect::<Vec<_>>();
    ordered.sort_by_key(|reading| (reading.epoch, reading.id));
    let best = (MIN_SIDE..=ordered.len() - MIN_SIDE)
        .map(|split| {
            let before = ordered[..split].iter().map(|r| r.mg_dl).collect::<Vec<_>>();
            let after = ordered[split..].iter().map(|r| r.mg_dl).collect::<Vec<_>>();
            let before_average = average(&before).unwrap_or_default();
            let after_average = average(&after).unwrap_or_default();
            (
                split,
                before_average,
                after_average,
                after_average - before_average,
            )
        })
        .max_by(|left, right| left.3.abs().total_cmp(&right.3.abs()));
    let Some((split, before_average, after_average, difference)) = best else {
        return Vec::new();
    };
    if difference.abs() < MIN_CHANGE_MG_DL {
        return Vec::new();
    }
    vec![TrendChange {
        changed_at: ordered[split].timestamp.clone(),
        direction: if difference > 0.0 { "higher" } else { "lower" }.to_owned(),
        before_average_mg_dl: before_average,
        after_average_mg_dl: after_average,
        difference_mg_dl: difference,
        before_count: split,
        after_count: ordered.len() - split,
    }]
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

fn average(values: &[u16]) -> Option<f64> {
    (!values.is_empty())
        .then(|| values.iter().map(|value| f64::from(*value)).sum::<f64>() / values.len() as f64)
}

fn standard_deviation(values: &[u16]) -> Option<f64> {
    let center = average(values)?;
    (values.len() > 1).then(|| {
        (values
            .iter()
            .map(|value| (f64::from(*value) - center).powi(2))
            .sum::<f64>()
            / (values.len() - 1) as f64)
            .sqrt()
    })
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
    use super::{detect_trend_changes, median};
    use crate::storage::StoredReading;

    #[test]
    fn median_supports_even_and_odd_samples() {
        assert_eq!(median(&[90, 100, 110]), Some(100.0));
        assert_eq!(median(&[90, 100, 110, 120]), Some(105.0));
        assert_eq!(median(&[]), None);
    }

    #[test]
    fn detects_sustained_level_shift_without_flagging_noise() {
        let readings = [100, 102, 98, 101, 99, 142, 145, 140, 143, 144]
            .into_iter()
            .enumerate()
            .map(|(index, mg_dl)| StoredReading {
                id: index as i64,
                epoch: index as i64,
                timestamp: format!("2026-09-{:02} 08:00:00", index + 1),
                mg_dl,
                mmol_l: f64::from(mg_dl) / 18.0,
                raw_value: mg_dl,
                status: 0,
                range_state: "normal".to_owned(),
                device_key: "test".to_owned(),
                occurrence: 0,
                note: None,
                tags: None,
                imported_at: "2026-09-01".to_owned(),
                meal_context: Some("Fasting".to_owned()),
                meal_event_id: None,
                quality_note: None,
            })
            .collect::<Vec<_>>();
        let changes = detect_trend_changes(&readings);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].direction, "higher");
        assert!(changes[0].difference_mg_dl > 35.0);
    }
}
