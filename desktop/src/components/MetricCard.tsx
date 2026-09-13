type Props = { label: string; value: string; note: string; accent?: boolean };
export function MetricCard({ label, value, note, accent }: Props) {
  return <article className={`metric ${accent ? "metric--accent" : ""}`}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}
