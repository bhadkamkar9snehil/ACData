import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar } from "../components/RangeBar";
import { TrendChart } from "../components/TrendChart";
import { groupSummary, robustOutliers, summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";

export function Explore({ readings }: { readings: Reading[] }) {
  const stats = summarize(readings);
  const unusual = robustOutliers(readings);
  const mealGroups = groupSummary(readings, reading => reading.meal || "Unclassified");
  const windows = [["Overnight", 0, 6], ["Morning", 6, 11], ["Midday", 11, 16], ["Evening", 16, 21], ["Night", 21, 24]] as const;
  const hours = windows.map(([label, start, end]) => {
    const values = readings.filter((reading) => { const hour = new Date(reading.timestamp).getHours(); return hour >= start && hour < end; }).map((reading) => reading.mgDl);
    return { label, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 };
  });
  return <><header className="page-header"><div><h1>Explore patterns</h1><p>All views use meter-local time and intermittent samples.</p></div><select aria-label="Date range" defaultValue="28"><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="all">All readings</option></select></header><section className="panel"><div className="panel-title"><div><h2>Individual samples</h2></div></div><TrendChart readings={readings} /></section><div className="analysis-grid"><section className="panel"><h2 className="serif">Where samples landed</h2><RangeBar {...stats.counts} total={stats.total} /></section><section className="panel"><h2 className="serif">Average by time window</h2><div className="chart"><ResponsiveContainer width="100%" height={230}><BarChart data={hours}><CartesianGrid vertical={false} stroke="#ddd7cc" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="average" fill="#32695f" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div></section><section className="panel"><h2 className="serif">Meal context</h2><div className="compact-list">{mealGroups.map(group => <div key={group.label}><b>{group.label}</b><span>{group.median} mg/dL median · {group.count} samples</span></div>)}</div></section><section className="panel"><h2 className="serif">Unusual samples</h2><p>{unusual.length ? `${unusual.length} statistically unusual readings need context review.` : "No robust statistical outliers detected with the available sample."}</p><small>These readings remain in every calculation and may be clinically meaningful.</small></section></div></>;
}
