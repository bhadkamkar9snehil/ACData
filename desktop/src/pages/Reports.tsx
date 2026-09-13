import { FileDown } from "lucide-react";
import { Button } from "../components/Button";
import { summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";
import { exportReport } from "../lib/backend";

export function Reports({ readings }: { readings: Reading[] }) {
  const stats = summarize(readings);
  return <><header className="page-header"><div><h1>Make a clear report.</h1><p>Choose what to include, then save a private local PDF.</p></div></header><div className="report-grid"><section className="panel form"><label>Date range<select defaultValue="28"><option value="28">Last 28 days</option><option value="all">All readings</option></select></label><label>Display unit<select defaultValue="mg"><option value="mg">mg/dL</option><option value="mmol">mmol/L</option></select></label><label className="check"><input type="checkbox" defaultChecked /> Include meal context</label><label className="check"><input type="checkbox" defaultChecked /> Include notes</label><Button icon={<FileDown size={17} />} onClick={() => void exportReport()}>Export PDF</Button></section><section className="report-preview"><p className="section-label">REPORT PREVIEW</p><h2>Glucose summary</h2><p>Last 28 days · {stats.total} samples</p><div><span>Average</span><b>{Math.round(stats.average)} mg/dL</b></div><div><span>Sampled in range</span><b>{Math.round(stats.counts.range / stats.total * 100)}%</b></div><small>Generated locally by AccuChek Local</small></section></div></>;
}
