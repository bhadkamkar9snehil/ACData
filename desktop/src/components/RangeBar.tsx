type Props = { low: number; range: number; high: number; total: number };
export function RangeBar({ low, range, high, total }: Props) {
  const pct = (value: number) => `${Math.round(value / Math.max(total, 1) * 100)}%`;
  return <div><div className="range-bar" aria-label={`${pct(range)} of sampled readings in range`}><span className="low" style={{ width: pct(low) }} /><span className="in-range" style={{ width: pct(range) }} /><span className="high" style={{ width: pct(high) }} /></div><div className="range-key"><span><i className="dot low" />Low {pct(low)}</span><span><i className="dot in-range" />In range {pct(range)}</span><span><i className="dot high" />High {pct(high)}</span></div></div>;
}
