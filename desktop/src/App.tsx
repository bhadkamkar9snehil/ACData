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
import { loadReadings } from "./lib/backend";
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
  const refresh = useCallback(
    async () => setReadings(await loadReadings()),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visibleReadings = readings.length ? readings : demoReadings;
  const isDemo = readings.length === 0;
  const pages = {
    overview: <Overview readings={visibleReadings} isDemo={isDemo} />,
    explore: <Explore readings={visibleReadings} />,
    readings: <Readings readings={visibleReadings} />,
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
      <main>{pages[page]}</main>
    </div>
  );
}
