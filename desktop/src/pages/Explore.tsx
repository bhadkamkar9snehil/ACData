import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RangeBar } from "../components/RangeBar";
import { TrendChart } from "../components/TrendChart";
import { summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";

export function Explore({ readings }: { readings: Reading[] }) {
  const stats = summarize(readings);
  const hours = ["00–06", "06–09", "09–12", "12–18", "18–21", "21–24"].map((label, index) => {
    const values = readings.filter((reading) => Math.floor(new Date(reading.timestamp).getHours() / 4) === index).map((reading) => reading.mgDl);
    return { label, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 };
  });
  return <><header className="page-header"><div><h1>Explore patterns.</h1><p>All views use meter-local time and intermittent samples.</p></div><select aria-label="Date range" defaultValue="28"><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="all">All readings</option></select></header><section className="panel"><div className="panel-title"><div><p className="section-label">TREND</p><h2>Individual samples</h2></div></div><TrendChart readings={readings} /></section><div className="analysis-grid"><section className="panel"><p className="section-label">RANGE COMPOSITION</p><h2 className="serif">Where samples landed</h2><RangeBar {...stats.counts} total={stats.total} /></section><section className="panel"><p className="section-label">TIME OF DAY</p><h2 className="serif">Average by window</h2><div className="chart"><ResponsiveContainer width="100%" height={230}><BarChart data={hours}><CartesianGrid vertical={false} stroke="#ddd7cc" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="average" fill="#32695f" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div></section></div></>;
}
