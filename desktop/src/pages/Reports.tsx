import { Check, FileDown, Sheet } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { filterByDays, summarize } from "../lib/analytics";
import { exportExcel, exportReport } from "../lib/backend";
import type { Reading } from "../lib/types";

export function Reports({ readings }: { readings: Reading[] }) {
  const [period, setPeriod] = useState<28 | 90 | "all">(28);
  const [unit, setUnit] = useState<"mg" | "mmol">("mg");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const visible = filterByDays(readings, period);
  const stats = summarize(visible);
  const sampledRange = stats.total
    ? Math.round((stats.counts.range / stats.total) * 100)
    : 0;

  const save = async (format: "pdf" | "excel") => {
    setStatus("working");
    try {
      const path = format === "pdf"
        ? await exportReport(period === "all" ? null : period, unit)
        : await exportExcel(period === "all" ? null : period);
      setMessage(path);
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Doctor report</h1>
          <p>
            A concise clinical summary followed by patterns, charts and
            auditable source readings.
          </p>
        </div>
      </header>
      <div className="report-grid">
        <section className="panel form report-controls">
          <h2>Prepare report</h2>
          <label>
            Date range
            <select
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value === "all"
                    ? "all"
                    : (Number(event.target.value) as 28 | 90),
                )
              }
            >
              <option value="28">Last 28 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All readings</option>
            </select>
          </label>
          <label>
            Display unit
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as "mg" | "mmol")}
            >
              <option value="mg">mg/dL</option>
              <option value="mmol">mmol/L</option>
            </select>
          </label>
          <div className="report-contents">
            <b>Included automatically</b>
            <span>
              <Check /> Safety signals and sampled range
            </span>
            <span>
              <Check /> Time-of-day and meal categories
            </span>
            <span>
              <Check /> Trend changes and unusual readings
            </span>
            <span>
              <Check /> Daily and hourly charts
            </span>
            <span>
              <Check /> Source-reading appendix
            </span>
          </div>
          <Button
            icon={<FileDown size={17} />}
            disabled={status === "working" || !stats.total}
            onClick={() => void save("pdf")}
          >
            {status === "working" ? "Building report…" : "Export private PDF"}
          </Button>
          <Button
            icon={<Sheet size={17} />}
            tone="quiet"
            disabled={status === "working" || !readings.length}
            onClick={() => void save("excel")}
          >
            Export to Excel
          </Button>
          {status !== "idle" && status !== "working" && (
            <p
              role="status"
              className={`export-status export-status--${status}`}
            >
              {status === "done"
                ? "Report saved locally: "
                : "Could not create report: "}
              {message}
            </p>
          )}
        </section>
        <ReportPreview
          stats={stats}
          sampledRange={sampledRange}
          period={period}
        />
      </div>
    </>
  );
}

function ReportPreview({
  stats,
  sampledRange,
  period,
}: {
  stats: ReturnType<typeof summarize>;
  sampledRange: number;
  period: 28 | 90 | "all";
}) {
  return (
    <section className="report-preview">
      <div className="report-preview-heading">
        <div>
          <h2>Glucose review</h2>
          <p>
            {period === "all" ? "All available data" : `Last ${period} days`} ·{" "}
            {stats.total} finger-stick samples
          </p>
        </div>
        <span>Clinical discussion</span>
      </div>
      <div className="report-alert">
        <span>Review first</span>
        <b>
          {stats.counts.low} low · {stats.counts.high} high samples
        </b>
      </div>
      <div className="report-stat-grid">
        <div>
          <span>Median</span>
          <b>{stats.median}</b>
          <small>mg/dL</small>
        </div>
        <div>
          <span>Sampled in range</span>
          <b>{sampledRange}%</b>
          <small>70–180 mg/dL</small>
        </div>
        <div>
          <span>Variability</span>
          <b>{Math.round(stats.deviation)}</b>
          <small>mg/dL sample SD</small>
        </div>
      </div>
      <div className="report-outline">
        <b>Report sequence</b>
        <ol>
          <li>Urgent signals and core statistics</li>
          <li>Distribution and time-of-day patterns</li>
          <li>Detected level changes and context</li>
          <li>Source readings with annotations</li>
        </ol>
      </div>
      <small className="report-footnote">
        Spot samples do not represent continuous time in range. The report
        provides no dosing advice.
      </small>
    </section>
  );
}
