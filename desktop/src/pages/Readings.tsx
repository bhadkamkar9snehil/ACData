import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { inDesktop, saveReadingContext } from "../lib/backend";
import type { Reading } from "../lib/types";

const contexts = [
  "Fasting",
  "Before breakfast",
  "After breakfast",
  "Before lunch",
  "After lunch",
  "Before dinner",
  "After dinner",
  "Bedtime",
  "Other",
];

export function Readings({
  readings,
  onUpdated,
}: {
  readings: Reading[];
  onUpdated: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<number>();
  const filtered = useMemo(
    () =>
      readings.filter((reading) =>
        `${reading.mgDl} ${reading.meal}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, readings],
  );
  const classify = async (id: number, context: string) => {
    setSaving(id);
    try {
      await saveReadingContext(id, context || null);
      await onUpdated();
    } finally {
      setSaving(undefined);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Reading history</h1>
          <p>
            Raw meter values stay unchanged; context is stored as a separate
            local annotation.
          </p>
        </div>
      </header>
      <label className="search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search value or context"
        />
      </label>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date & time</th>
              <th>Glucose</th>
              <th>Meal context</th>
              <th>Raw status</th>
            </tr>
          </thead>
          <tbody>
            {[...filtered].reverse().map((reading) => (
              <tr key={reading.id}>
                <td>
                  {new Date(reading.timestamp).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  <b>{reading.mgDl}</b> mg/dL
                </td>
                <td>
                  <select
                    className="context-select"
                    aria-label={`Meal context for ${reading.timestamp}`}
                    value={reading.meal ?? ""}
                    disabled={!inDesktop() || saving === reading.id}
                    onChange={(event) =>
                      void classify(reading.id, event.target.value)
                    }
                  >
                    <option value="">Not classified</option>
                    {contexts.map((context) => (
                      <option key={context}>{context}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <code>
                    0x
                    {reading.status.toString(16).padStart(4, "0").toUpperCase()}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
