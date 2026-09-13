import { Cable, CheckCircle2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { syncMeter } from "../lib/backend";

export function ImportPage({ onImported }: { onImported: () => Promise<void> }) {
  const [result, setResult] = useState("Ready to read when the meter displays PC.");
  const read = async () => { setResult("Reading meter…"); try { const count = await syncMeter(); await onImported(); setResult(`${count} new readings saved locally.`); } catch (error) { setResult(error instanceof Error ? error.message : String(error)); } };
  return <><header className="page-header"><div><h1>Import your meter.</h1><p>A read-only transfer from Accu-Chek Instant.</p></div></header><section className="device-card"><div className="device-visual"><Cable size={46} strokeWidth={1.3} /></div><div><p className="section-label">CONNECTED DEVICE</p><h2>Accu-Chek Instant</h2><p>Roche · USB 173A:21D7 · PHDC/WinUSB</p><div className="status-ok"><CheckCircle2 size={16} />{result}</div></div><Button onClick={read}>Read meter</Button></section><section className="panel safety"><LockKeyhole size={24} /><div><b>Read-only by design</b><p>AccuChek Local reads identity and measurements. It never changes the meter clock, records, or settings.</p></div></section></>;
}
