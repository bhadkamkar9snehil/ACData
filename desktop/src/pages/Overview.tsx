import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "../components/Button";
import { MetricCard } from "../components/MetricCard";
import { RangeBar } from "../components/RangeBar";
import { TrendChart } from "../components/TrendChart";
import { summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";

export function Overview({ readings, isDemo, onImport }: {
  readings: Reading[];
  isDemo: boolean;
  onImport: () => void;
}) {
  const stats = summarize(readings);
  const dates = readings.map(({ timestamp }) => timestamp).sort();
  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const dateRange = dates.length
    ? `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
    : "No readings imported";
  const recent = readings.at(-1)?.mgDl;

  return <>
    <header className="page-header">
      <div>
        <h1>Glucose overview</h1>
        <p className="date"><CalendarDays size={15} />{dateRange} · {stats.total} readings</p>
      </div>
      <Button icon={<ArrowUpRight size={17} />} onClick={onImport}>Import meter</Button>
    </header>
    {isDemo && <div className="demo-note">Preview data · import your meter to see your readings.</div>}
    {!readings.length ? <section className="panel"><h2>Connect your meter to get started</h2><p>Import readings from your Accu-Chek Instant over USB.</p></section> : <>
      <section className="metrics">
        <MetricCard label="Average" value={`${Math.round(stats.average)}`} note="mg/dL" accent />
        <MetricCard label="Median" value={`${stats.median}`} note="mg/dL" />
        <MetricCard label="Variability" value={`${Math.round(stats.deviation)}`} note="mg/dL sample SD" />
        <MetricCard label="Latest" value={`${recent}`} note="mg/dL" />
      </section>
      <section className="panel range-panel">
        <div><h2>{Math.round(stats.counts.range / stats.total * 100)}<span>%</span></h2><p>Sampled readings within 70–180 mg/dL</p></div>
        <RangeBar {...stats.counts} total={stats.total} />
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Reading trend</h2><p>Each dot represents one finger-stick reading.</p></div>
        <TrendChart readings={readings} />
      </section>
    </>}
  </>;
}
