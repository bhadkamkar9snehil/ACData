import { BarChart3, Cable, FileText, FlaskConical, Gauge, Settings2 } from "lucide-react";
import type { Page } from "../lib/types";

const items = [
  ["overview", "Overview", Gauge], ["explore", "Explore", BarChart3], ["readings", "Readings", FlaskConical],
  ["import", "Import meter", Cable], ["reports", "Reports", FileText], ["settings", "Settings", Settings2],
] as const;

export function Sidebar({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  return <aside className="sidebar"><div className="brand"><span className="brand-mark">AC</span><div><b>AccuChek</b><small>LOCAL</small></div></div><nav aria-label="Main navigation">{items.map(([id, label, Icon]) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => onChange(id)}><Icon size={19} strokeWidth={1.8} />{label}</button>)}</nav><div className="privacy"><span className="pulse" /><div><b>Private by design</b><small>Local device · no cloud</small></div></div></aside>;
}
