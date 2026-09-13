import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { TrendChart } from "../components/TrendChart";
import {
  categorySummary,
  detectTrendChanges,
  filterByDays,
  patternInsights,
  robustOutliers,
  summarize,
  type CategorySummary,
} from "../lib/analytics";
import type { Reading } from "../lib/types";

const windows = [
  ["Overnight", 0, 6],
  ["Morning", 6, 11],
  ["Midday", 11, 16],
  ["Evening", 16, 21],
  ["Night", 21, 24],
] as const;
const timeWindow = (reading: Reading) =>
  windows.find(([, start, end]) => {
    const hour = new Date(reading.timestamp).getHours();
    return hour >= start && hour < end;
  })?.[0] ?? "Unknown";
const weekday = (reading: Reading) =>
  new Date(reading.timestamp).toLocaleDateString("en-IN", { weekday: "short" });

export function Explore({ readings }: { readings: Reading[] }) {
  const [period, setPeriod] = useState<7 | 28 | "all">(28);
  const visible = filterByDays(readings, period);
  const stats = summarize(visible);
  const byTime = categorySummary(visible, timeWindow);
  const byMeal = categorySummary(
    visible,
    (reading) => reading.meal || "Unclassified",
  );
  const byWeekday = categorySummary(visible, weekday);
  const changes = detectTrendChanges(visible);
  const insights = patternInsights(visible);
  const unusual = robustOutliers(visible);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Pattern analysis</h1>
          <p>
            Averages, medians and changes across intermittent meter samples.
          </p>
        </div>
        <select
          aria-label="Date range"
          value={period}
          onChange={(event) =>
            setPeriod(
              event.target.value === "all"
                ? "all"
                : (Number(event.target.value) as 7 | 28),
            )
          }
        >
          <option value="7">Last 7 days</option>
          <option value="28">Last 28 days</option>
          <option value="all">All readings</option>
        </select>
      </header>
      <section className="analysis-metrics">
        <AnalysisMetric
          label="Average"
          value={stats.average}
          detail={`${stats.total} samples`}
        />
        <AnalysisMetric
          label="Median"
          value={stats.median}
          detail="Less affected by extremes"
        />
        <AnalysisMetric
          label="Variability"
          value={stats.deviation}
          detail="Sample standard deviation"
        />
        <AnalysisMetric
          label="Unusual"
          value={unusual.length}
          detail="Robust statistical flags"
        />
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Reading trend</h2>
            <p>
              Automatically compares sustained levels before and after possible
              shifts.
            </p>
          </div>
        </div>
        <TrendChart readings={visible} />
        {changes.map((change) => (
          <div
            className={`shift-card shift-card--${change.direction}`}
            key={change.changedAt}
          >
            {change.direction === "higher" ? (
              <ArrowUpRight />
            ) : (
              <ArrowDownRight />
            )}
            <div>
              <b>
                Sustained shift {change.direction} by{" "}
                {Math.abs(Math.round(change.difference))} mg/dL
              </b>
              <p>
                Detected near{" "}
                {new Date(change.changedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                . Average changed from {Math.round(change.beforeAverage)} to{" "}
                {Math.round(change.afterAverage)} mg/dL.
              </p>
              <small>
                {change.beforeCount} samples before · {change.afterCount} after
                · review alongside treatment and meal changes
              </small>
            </div>
          </div>
        ))}
      </section>
      <section className="analytics-section">
        <div>
          <h2>Category comparisons</h2>
          <p>
            Each table includes sample size so sparse categories are obvious.
          </p>
        </div>
        <div className="category-grid">
          <CategoryPanel title="Time of day" rows={byTime} chart />
          <CategoryPanel title="Meal context" rows={byMeal} />
          <CategoryPanel title="Day of week" rows={byWeekday} />
        </div>
      </section>
      <section className="analytics-section">
        <div>
          <h2>Detected patterns</h2>
          <p>Generated only where at least three comparable samples exist.</p>
        </div>
        <div className="insight-grid">
          {insights.length ? (
            insights.map((insight) => (
              <article
                className={`pattern-card pattern-card--${insight.kind}`}
                key={insight.title}
              >
                {insight.kind === "attention" ? <CircleAlert /> : <Sparkles />}
                <div>
                  <b>{insight.title}</b>
                  <p>{insight.detail}</p>
                  <small>Evidence: {insight.sampleCount} samples</small>
                </div>
              </article>
            ))
          ) : (
            <article className="pattern-card">
              <Sparkles />
              <div>
                <b>More context will unlock patterns</b>
                <p>
                  Classify readings by fasting, before meal, after meal or
                  bedtime.
                </p>
              </div>
            </article>
          )}
        </div>
      </section>
      <p className="analysis-disclaimer">
        Statistical changes are screening signals, not proof of a medication or
        meal effect. Readings are never removed automatically.
      </p>
    </>
  );
}

function AnalysisMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <b>{Math.round(value)}</b>
      <small>{detail}</small>
    </div>
  );
}

function CategoryPanel({
  title,
  rows,
  chart = false,
}: {
  title: string;
  rows: CategorySummary[];
  chart?: boolean;
}) {
  return (
    <section className="panel category-panel">
      <h3>{title}</h3>
      {chart && (
        <div className="mini-chart">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={rows}>
              <CartesianGrid vertical={false} stroke="#e2dbcf" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} width={32} />
              <Tooltip />
              <Bar dataKey="average" fill="#32695f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div
        className="category-table"
        role="table"
        aria-label={`${title} statistics`}
      >
        <div className="category-head" role="row">
          <span>Category</span>
          <span>Avg</span>
          <span>Median</span>
          <span>SD</span>
          <span>Range</span>
          <span>n</span>
        </div>
        {rows.map((row) => (
          <div role="row" key={row.label}>
            <b>{row.label}</b>
            <span>{Math.round(row.average)}</span>
            <span>{Math.round(row.median)}</span>
            <span>{Math.round(row.deviation)}</span>
            <span>{Math.round(row.sampledInRangePercent)}%</span>
            <span>{row.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
