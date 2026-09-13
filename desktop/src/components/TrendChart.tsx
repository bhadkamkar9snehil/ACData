import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Reading } from "../lib/types";

export function TrendChart({ readings }: { readings: Reading[] }) {
  const data = readings.map((reading) => ({ ...reading, day: new Date(reading.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }));
  return <div className="chart" role="img" aria-label={`Trend of ${data.length} intermittent finger-stick readings. Target band 70 to 180 milligrams per decilitre.`}><ResponsiveContainer width="100%" height={300}><LineChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#ddd7cc" strokeDasharray="2 5" /><ReferenceArea y1={70} y2={180} fill="#dcece7" fillOpacity={0.7} /><XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={34} /><YAxis domain={[40, 240]} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #cfc8bb", background: "#fffdf8" }} formatter={(value) => [`${value} mg/dL`, "Reading"]} /><Line type="monotone" dataKey="mgDl" stroke="#173f3a" strokeWidth={2.5} dot={{ fill: "#f4f0e8", stroke: "#173f3a", strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: "#173f3a" }} /></LineChart></ResponsiveContainer></div>;
}
