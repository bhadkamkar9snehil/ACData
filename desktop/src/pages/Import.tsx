import { Cable, CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { syncMeter } from "../lib/backend";

export function ImportPage({ onImported }: { onImported: () => Promise<void> }) {
  const [status, setStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [result, setResult] = useState("Connect the meter by USB, then select Read meter.");

  const read = async () => {
    if (status === "reading") return;
    setStatus("reading");
    setResult("Reading meter… Keep it connected until the transfer finishes.");
    try {
      const count = await syncMeter();
      await onImported();
      setResult(count ? `${count} new readings saved locally.` : "Your readings are up to date. No duplicates were added.");
      setStatus("done");
    } catch (error) {
      setResult(`${String(error)}. Unplug the meter, reconnect it, and try again.`);
      setStatus("error");
    }
  };

  return <>
    <header className="page-header"><div><h1>Import your meter</h1><p>Download readings from your Accu-Chek Instant.</p></div></header>
    <section className="device-card" aria-busy={status === "reading"}>
      <div className="device-visual"><Cable size={46} strokeWidth={1.3} /></div>
      <div>
        <h2>Accu-Chek Instant</h2>
        <p>USB import · existing readings are automatically skipped</p>
        <div className="status-ok" role={status === "error" ? "alert" : "status"}>
          {status === "done" && <CheckCircle2 size={16} />}
          {status === "error" && <CircleAlert size={16} />}
          {result}
        </div>
      </div>
      <Button disabled={status === "reading"} onClick={() => void read()}>
        {status === "reading" ? "Reading…" : "Read meter"}
      </Button>
    </section>
    <section className="panel safety"><LockKeyhole size={24} /><div><b>Read-only transfer</b><p>Your meter’s clock, readings, and settings stay unchanged.</p></div></section>
  </>;
}
