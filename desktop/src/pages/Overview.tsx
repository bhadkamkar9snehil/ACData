import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "../components/Button";
import { MetricCard } from "../components/MetricCard";
import { RangeBar } from "../components/RangeBar";
import { TrendChart } from "../components/TrendChart";
import { summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";

export function Overview({ readings, isDemo }: { readings: Reading[]; isDemo: boolean }) {
  const stats = summarize(readings);
  const recent = readings.at(-1)?.mgDl ?? 0;
  return <><header className="page-header"><div><p className="date"><CalendarDays size={15} />17 Aug – 13 Sep 2026</p><h1>Your glucose, in perspective.</h1><p>Patterns across {stats.total} intermittent finger-stick readings.</p></div><Button icon={<ArrowUpRight size={17} />}>Import meter</Button></header>{isDemo && <div className="demo-note">Preview data is displayed until the connected meter is imported.</div>}<section className="metrics"><MetricCard label="AVERAGE" value={`${Math.round(stats.average)}`} note="mg/dL" accent /><MetricCard label="MEDIAN" value={`${stats.median}`} note="mg/dL" /><MetricCard label="VARIABILITY" value={`${Math.round(stats.deviation)}`} note="mg/dL sample SD" /><MetricCard label="LATEST" value={`${recent}`} note="mg/dL" /></section><section className="panel range-panel"><div><p className="section-label">SAMPLED READINGS IN RANGE</p><h2>{Math.round(stats.counts.range / stats.total * 100)}<span>%</span></h2><p>Between 70 and 180 mg/dL</p></div><RangeBar {...stats.counts} total={stats.total} /></section><section className="panel"><div className="panel-title"><div><p className="section-label">READING TREND</p><h2>Four weeks at a glance</h2></div><p>Each dot is one finger-stick sample—not continuous glucose.</p></div><TrendChart readings={readings} /></section><section className="insight"><span>01</span><div><b>Your readings are most consistent before noon.</b><p>Morning samples show lower spread than evening samples. Add meal context to make this comparison more useful.</p></div></section></>;
}
