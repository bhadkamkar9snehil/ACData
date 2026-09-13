import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Reading } from "../lib/types";

export function Readings({ readings }: { readings: Reading[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => readings.filter((reading) => `${reading.mgDl} ${reading.meal}`.toLowerCase().includes(query.toLowerCase())), [query, readings]);
  return <><header className="page-header"><div><h1>Reading history.</h1><p>Source values, status words and your local context.</p></div></header><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search value or context" /></label><section className="panel table-wrap"><table><thead><tr><th>Date & time</th><th>Glucose</th><th>Context</th><th>Raw status</th></tr></thead><tbody>{[...filtered].reverse().map((reading) => <tr key={reading.id}><td>{new Date(reading.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td><td><b>{reading.mgDl}</b> mg/dL</td><td>{reading.meal ?? "Not tagged"}</td><td><code>0x{reading.status.toString(16).padStart(4, "0").toUpperCase()}</code></td></tr>)}</tbody></table></section></>;
}
