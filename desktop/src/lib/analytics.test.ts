import { describe, expect, it } from "vitest";
import {
  categorySummary,
  detectTrendChanges,
  filterByDays,
  patternInsights,
} from "./analytics";
import type { Reading } from "./types";

const readings = (values: number[]): Reading[] =>
  values.map((mgDl, index) => ({
    id: index + 1,
    timestamp: new Date(2026, 8, index + 1, 8).toISOString(),
    mgDl,
    status: 0,
    meal: index % 2 ? "After breakfast" : "Fasting",
  }));

describe("categorySummary", () => {
  it("reports average, median, spread, range percentage, and sample count", () => {
    const [fasting] = categorySummary(
      readings([80, 100, 120, 200]),
      (row) => row.meal ?? "Unknown",
    ).filter((row) => row.label === "Fasting");
    expect(fasting).toMatchObject({
      count: 2,
      average: 100,
      median: 100,
      minimum: 80,
      maximum: 120,
      sampledInRangePercent: 100,
    });
  });
});

describe("patternInsights", () => {
  it("ranks a repeated high category with evidence", () => {
    const data = readings([90, 95, 100, 205, 215, 220]);
    data.slice(3).forEach((row) => {
      row.meal = "After dinner";
    });
    const insights = patternInsights(data);
    expect(insights[0]).toMatchObject({ kind: "attention", sampleCount: 3 });
    expect(insights[0].title).toContain("After dinner");
  });
});

describe("detectTrendChanges", () => {
  it("detects a sustained shift and reports both evidence windows", () => {
    const [change] = detectTrendChanges(
      readings([100, 102, 98, 101, 99, 142, 145, 140, 143, 144]),
    );
    expect(change.direction).toBe("higher");
    expect(change.difference).toBeGreaterThan(35);
    expect(change.beforeCount).toBeGreaterThanOrEqual(4);
    expect(change.afterCount).toBeGreaterThanOrEqual(4);
  });

  it("does not call ordinary noise a trend change", () => {
    expect(
      detectTrendChanges(readings([100, 104, 98, 103, 99, 101, 105, 97])),
    ).toEqual([]);
  });
});

describe("filterByDays", () => {
  it("anchors relative periods to the newest reading", () => {
    const data = readings(Array.from({ length: 10 }, () => 100));
    expect(filterByDays(data, 7)).toHaveLength(8);
    expect(filterByDays(data, "all")).toHaveLength(10);
  });
});
