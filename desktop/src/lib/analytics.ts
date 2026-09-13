import type { Reading } from "./types";

export const classify = (value: number) =>
  value < 70 ? "low" : value <= 180 ? "range" : "high";

export function filterByDays(readings: Reading[], days: number | "all") {
  if (days === "all" || !readings.length) return readings;
  const newest = Math.max(
    ...readings.map((reading) => new Date(reading.timestamp).getTime()),
  );
  const cutoff = newest - days * 24 * 60 * 60 * 1000;
  return readings.filter(
    (reading) => new Date(reading.timestamp).getTime() >= cutoff,
  );
}

const medianOf = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function summarize(readings: Reading[]) {
  const values = readings.map(({ mgDl }) => mgDl).sort((a, b) => a - b);
  const average =
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const median = medianOf(values);
  const variance =
    values.length > 1
      ? values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
        (values.length - 1)
      : 0;
  const counts = readings.reduce(
    (acc, reading) => ({
      ...acc,
      [classify(reading.mgDl)]: acc[classify(reading.mgDl)] + 1,
    }),
    { low: 0, range: 0, high: 0 },
  );
  return {
    average,
    median,
    deviation: Math.sqrt(variance),
    counts,
    total: readings.length,
  };
}

export type CategorySummary = {
  label: string;
  count: number;
  average: number;
  median: number;
  deviation: number;
  minimum: number;
  maximum: number;
  sampledInRangePercent: number;
};

export function categorySummary(
  readings: Reading[],
  key: (reading: Reading) => string,
): CategorySummary[] {
  const groups = readings.reduce((map, reading) => {
    const label = key(reading);
    map.set(label, [...(map.get(label) ?? []), reading]);
    return map;
  }, new Map<string, Reading[]>());
  return [...groups].map(([label, rows]) => {
    const stats = summarize(rows);
    const values = rows.map((row) => row.mgDl);
    return {
      label,
      count: rows.length,
      average: stats.average,
      median: stats.median,
      deviation: stats.deviation,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      sampledInRangePercent: (100 * stats.counts.range) / rows.length,
    };
  });
}

export type TrendChange = {
  changedAt: string;
  direction: "higher" | "lower";
  difference: number;
  beforeAverage: number;
  afterAverage: number;
  beforeCount: number;
  afterCount: number;
};

export function detectTrendChanges(readings: Reading[]): TrendChange[] {
  const minimumSide = 4;
  const ordered = [...readings].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  if (ordered.length < minimumSide * 2) return [];
  const candidates = Array.from(
    { length: ordered.length - minimumSide * 2 + 1 },
    (_, index) => index + minimumSide,
  ).map((split) => {
    const before = summarize(ordered.slice(0, split));
    const after = summarize(ordered.slice(split));
    return { split, before, after, difference: after.average - before.average };
  });
  const best = candidates.sort(
    (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
  )[0];
  if (Math.abs(best.difference) < 20) return [];
  return [
    {
      changedAt: ordered[best.split].timestamp,
      direction: best.difference > 0 ? "higher" : "lower",
      difference: best.difference,
      beforeAverage: best.before.average,
      afterAverage: best.after.average,
      beforeCount: best.before.total,
      afterCount: best.after.total,
    },
  ];
}

export type PatternInsight = {
  kind: "attention" | "positive" | "information";
  title: string;
  detail: string;
  sampleCount: number;
};

export function patternInsights(readings: Reading[]): PatternInsight[] {
  const mealPatterns = categorySummary(
    readings,
    (row) => row.meal ?? "Unclassified",
  )
    .filter((group) => group.label !== "Unclassified" && group.count >= 3)
    .map((group) => ({
      kind:
        group.average > 180
          ? ("attention" as const)
          : group.sampledInRangePercent >= 70
            ? ("positive" as const)
            : ("information" as const),
      title: `${group.label} averages ${Math.round(group.average)} mg/dL`,
      detail: `${Math.round(group.sampledInRangePercent)}% of samples were 70–180 mg/dL; median ${Math.round(group.median)}, spread ${Math.round(group.deviation)} mg/dL SD.`,
      sampleCount: group.count,
    }));
  return mealPatterns.sort((a, b) => {
    const priority = { attention: 0, information: 1, positive: 2 };
    return priority[a.kind] - priority[b.kind] || b.sampleCount - a.sampleCount;
  });
}

export function robustOutliers(readings: Reading[]) {
  if (readings.length < 7) return [];
  const values = readings.map(({ mgDl }) => mgDl).sort((a, b) => a - b);
  const middle = (items: number[]) =>
    items.length % 2
      ? items[Math.floor(items.length / 2)]
      : (items[items.length / 2 - 1] + items[items.length / 2]) / 2;
  const center = middle(values);
  const mad = middle(
    values.map((value) => Math.abs(value - center)).sort((a, b) => a - b),
  );
  if (!mad) return [];
  return readings.filter(
    (reading) => Math.abs((0.6745 * (reading.mgDl - center)) / mad) > 3.5,
  );
}

export function groupSummary(
  readings: Reading[],
  key: (reading: Reading) => string,
) {
  return categorySummary(readings, key);
}
