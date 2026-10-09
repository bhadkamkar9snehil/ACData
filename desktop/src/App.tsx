import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { demoReadings } from "./lib/demo-data";
import type { Page } from "./lib/types";
import { Overview } from "./pages/Overview";
import { Explore } from "./pages/Explore";
import { ImportPage } from "./pages/Import";
import { Placeholder } from "./pages/Placeholder";
import { Readings } from "./pages/Readings";
import { Reports } from "./pages/Reports";
import { Treatments } from "./pages/Treatments";
import { inDesktop, loadReadings } from "./lib/backend";
import type { Reading } from "./lib/types";

const copy: Record<Exclude<Page, "overview">, [string, string]> = {
  explore: [
    "Explore patterns",
    "Compare distribution, weekday and time-of-day patterns.",
  ],
  readings: [
    "Reading history",
    "Search source-faithful measurements, notes and meal context.",
  ],
  import: [
    "Import your meter",
    "Read from Accu-Chek Instant over USB. No meter settings are changed.",
  ],
  reports: [
    "Clinical reports",
    "Create a local PDF from a date range you choose.",
  ],
  settings: ["Settings", "Units, personal thresholds, storage and privacy."],
  treatments: ["Treatment context", "Medication changes and insulin doses."],
};

export function App() {
  const [page, setPage] = useState<Page>("overview");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(
    async () => {
      setLoading(true);
      setError("");
      try {
        setReadings(await loadReadings());
      } catch (error) {
        setError(String(error));
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const isDemo = !inDesktop();
  const visibleReadings = isDemo ? demoReadings : readings;
  const pages = {
    overview: <Overview readings={visibleReadings} isDemo={isDemo} onImport={() => setPage("import")} />,
    explore: <Explore readings={visibleReadings} />,
    readings: <Readings readings={visibleReadings} onUpdated={refresh} />,
    treatments: <Treatments />,
    import: <ImportPage onImported={refresh} />,
    reports: <Reports readings={visibleReadings} />,
    settings: (
      <Placeholder title={copy.settings[0]} text={copy.settings[1]}>
        <div className="settings-list">
          <b>Display unit</b>
          <span>mg/dL</span>
          <b>Target range</b>
          <span>70–180 mg/dL</span>
          <b>Data location</b>
          <span>Local app data</span>
          <b>Network</b>
          <span>Disabled</span>
        </div>
      </Placeholder>
    ),
  };
  return (
    <div className="app-shell">
      <Sidebar page={page} onChange={setPage} />
      <main>{error ? <section className="panel" role="alert"><h2>Could not load your readings</h2><p>{error}</p><button className="button" onClick={() => void refresh()}>Try again</button></section> : loading ? <p role="status">Loading readings…</p> : pages[page]}</main>
    </div>
  );
}
