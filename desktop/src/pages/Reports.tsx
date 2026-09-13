import { FileDown } from "lucide-react";
import { Button } from "../components/Button";
import { summarize } from "../lib/analytics";
import type { Reading } from "../lib/types";
import { exportReport } from "../lib/backend";

export function Reports({ readings }: { readings: Reading[] }) {
  const stats = summarize(readings);
  const sampledRange = stats.total
    ? Math.round((stats.counts.range / stats.total) * 100)
    : 0;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Doctor report</h1>
          <p>
            Safety signals and treatment context first; source readings remain
            available.
          </p>
        </div>
      </header>
      <div className="report-grid">
        <section className="panel form">
          <label>
            Date range
            <select defaultValue="28">
              <option value="28">Last 28 days</option>
              <option value="all">All readings</option>
            </select>
          </label>
          <label>
            Display unit
            <select defaultValue="mg">
              <option value="mg">mg/dL</option>
              <option value="mmol">mmol/L</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" defaultChecked /> Treatment timeline
          </label>
          <label className="check">
            <input type="checkbox" defaultChecked /> Meal comparisons and notes
          </label>
          <label className="check">
            <input type="checkbox" defaultChecked /> Source-reading appendix
          </label>
          <Button
            icon={<FileDown size={17} />}
            onClick={() => void exportReport()}
          >
            Export private PDF
          </Button>
        </section>
        <section className="report-preview">
          <p className="report-kicker">CLINICIAN SUMMARY · INTERMITTENT BGM</p>
          <h2>Glucose review</h2>
          <p>Last 28 days · {stats.total} finger-stick samples</p>
          <div className="report-alert">
            <span>Review first</span>
            <b>
              {stats.counts.low} low · {stats.counts.high} high samples
            </b>
          </div>
          <div>
            <span>Median</span>
            <b>{stats.median} mg/dL</b>
          </div>
          <div>
            <span>Sampled in range</span>
            <b>{sampledRange}%</b>
          </div>
          <div>
            <span>Variability</span>
            <b>{Math.round(stats.deviation)} mg/dL SD</b>
          </div>
          <small>
            Spot samples do not represent continuous time in range. Generated
            locally.
          </small>
        </section>
      </div>
    </>
  );
}
