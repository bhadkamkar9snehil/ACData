import type { Reading } from "./types";

export const classify = (value: number) => value < 70 ? "low" : value <= 180 ? "range" : "high";

export function summarize(readings: Reading[]) {
  const values = readings.map(({ mgDl }) => mgDl).sort((a, b) => a - b);
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;
  const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1) : 0;
  const counts = readings.reduce((acc, reading) => ({ ...acc, [classify(reading.mgDl)]: acc[classify(reading.mgDl)] + 1 }), { low: 0, range: 0, high: 0 });
  return { average, median, deviation: Math.sqrt(variance), counts, total: readings.length };
}

export function robustOutliers(readings: Reading[]) {
  if (readings.length < 7) return [];
  const values = readings.map(({ mgDl }) => mgDl).sort((a, b) => a - b);
  const middle = (items: number[]) => items.length % 2 ? items[Math.floor(items.length / 2)] : (items[items.length / 2 - 1] + items[items.length / 2]) / 2;
  const center = middle(values);
  const mad = middle(values.map(value => Math.abs(value - center)).sort((a, b) => a - b));
  if (!mad) return [];
  return readings.filter(reading => Math.abs(0.6745 * (reading.mgDl - center) / mad) > 3.5);
}

export function groupSummary(readings: Reading[], key: (reading: Reading) => string) {
  const groups = readings.reduce((map, reading) => {
    const label = key(reading);
    map.set(label, [...(map.get(label) ?? []), reading]);
    return map;
  }, new Map<string, Reading[]>());
  return [...groups].map(([label, rows]) => ({
    label,
    count: rows.length,
    median: summarize(rows).median,
  }));
}
