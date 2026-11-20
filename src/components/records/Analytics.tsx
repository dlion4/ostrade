import { useId, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, ChartNoAxesColumn, Grid2X2, Layers, Percent, Scale, Target } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { eatDay, netPnl, type TradeRecord } from "@/services/records";
import { dailyTotals, ratio, shortDate, summarize, tone, usd } from "./recordsView";

export function RecordMetrics({ trades }: { trades: TradeRecord[] }) {
  const m = summarize(trades), days = dailyTotals(trades);
  const best = [...days].sort((a, b) => b.net - a.net)[0];
  const worst = [...days].sort((a, b) => a.net - b.net)[0];
  const animated = (n: number, format: (n: number) => string) => <CountUp value={Math.round(n * 100)} duration={540} format={(value) => format(value / 100)} />;
  const cards = [
    { label: "Total trades", icon: Layers, value: <CountUp value={trades.length} duration={580} />, hint: "Closed positions", style: "orange" },
    { label: "Win rate", icon: Target, value: animated(m.winRate, (n) => `${n.toFixed(1)}%`), hint: `${m.wins} wins · ${m.losses} losses`, style: "green" },
    { label: "Profit factor", icon: Scale, value: m.profitFactor === Infinity ? "∞" : m.profitFactor === null ? "—" : animated(m.profitFactor, (n) => n.toFixed(2)), hint: "Winning P&L / losing P&L", style: "violet" },
    { label: "Average R", icon: Activity, value: m.avgR === null ? "—" : animated(m.avgR, (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`), hint: "Per unit of risk", style: "blue" },
    { label: "Best day", icon: ArrowUpRight, value: best ? animated(best.net, (n) => usd(n, true)) : "—", hint: best ? `${shortDate(best.date)} · ${best.count} trades` : "No trading days", style: "green", tint: best && tone(best.net) },
    { label: "Worst day", icon: ArrowDownRight, value: worst ? animated(worst.net, (n) => usd(n, true)) : "—", hint: worst ? `${shortDate(worst.date)} · ${worst.count} trades` : "No trading days", style: "rose", tint: worst && tone(worst.net) },
  ];
  return <div className="os-rec-metrics">{cards.map(({ label, icon: Icon, value, hint, style, tint }) => <article className="os-rec-card os-rec-metric" key={label}>
    <span className={`os-rec-icon os-rec-${style}`}><Icon size={16} strokeWidth={1.9} /></span><span className="os-rec-metric-label">{label}</span>
    <strong className={tint}>{value}</strong><small>{hint}</small>
  </article>)}</div>;
}

type Point = { date: string; net: number; count: number };
function Chart({ data, bars = false }: { data: Point[]; bars?: boolean }) {
  const unique = useId();
  const [active, setActive] = useState<number | null>(null);
  if (!data.length) return <div className="os-rec-empty">No closed trades in this range.</div>;
  const width = bars ? 370 : 690, height = 204, left = bars ? 54 : 60, right = width - 14, top = 13, bottom = 169;
  const values = data.map((p) => p.net);
  const max = Math.max(0, ...values), min = Math.min(0, ...values);
  const raw = Math.max(1, max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((value) => value >= raw / magnitude) ?? 10) * magnitude;
  const hi = Math.max(step, Math.ceil(max / step) * step);
  const lo = Math.floor(min / step) * step;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const span = right - left;
  const x = (index: number) => left + (bars || data.length === 1 ? (index + 0.5) / data.length : index / (data.length - 1)) * span;
  const y = (value: number) => bottom - (value - lo) / (hi - lo) * (bottom - top);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v.net)}`).join(" ");
  const labelCount = Math.min(bars ? 4 : 6, data.length);
  const tickIndices = Array.from({ length: labelCount }, (_, i) => Math.round(i * (data.length - 1) / Math.max(labelCount - 1, 1)));
  const hovered = active !== null ? data[active] : undefined;
  return <div className="os-rec-chart" tabIndex={0} aria-label={bars ? "Daily net P&L. Use arrow keys to review trading days." : "Cumulative P&L. Use arrow keys to review trading days."} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={(e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((index) => index === null ? (e.key === "ArrowRight" ? 0 : data.length - 1) : (index + (e.key === "ArrowRight" ? 1 : -1) + data.length) % data.length);
    }
  }}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={bars ? "Daily realized net P&L bar chart" : "Cumulative realized P&L line chart"}>
      <defs><linearGradient id={unique} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="var(--sd-accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--sd-accent)" stopOpacity=".015" /></linearGradient></defs>
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="os-rec-gridline" /><text x={left - 9} y={y(tick) + 4} textAnchor="end">{Math.abs(tick) >= 1000 ? `${tick < 0 ? "−" : ""}$${+(Math.abs(tick) / 1000).toFixed(2)}k` : usd(tick, false, 0)}</text></g>)}
      {lo < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} className="os-rec-zero" />}
      {bars ? data.map((d, i) => { const w = Math.min(span / data.length * 0.66, 26); return <rect key={d.date} x={x(i) - w / 2} width={w} y={Math.min(y(d.net), y(0))} height={Math.max(1, Math.abs(y(d.net) - y(0)))} rx={2} className={d.net >= 0 ? "os-rec-bar-up" : "os-rec-bar-down"}><title>{shortDate(d.date)}: {usd(d.net, true)}, {d.count} trades</title></rect>; }) : <>
        <path d={`${line} L${x(data.length - 1)},${bottom} L${x(0)},${bottom} Z`} fill={`url(#${unique})`} />
        <path className="os-rec-chart-line" d={line} fill="none" pathLength="1" />
        <circle cx={x(data.length - 1)} cy={y(values[values.length - 1])} r="4" fill="var(--sd-accent)" stroke="var(--sd-white)" strokeWidth="2" />
      </>}
      {tickIndices.map((i) => <text key={i} x={x(i)} y={192} textAnchor={!bars && data.length > 1 ? i === 0 ? "start" : i === data.length - 1 ? "end" : "middle" : "middle"}>{shortDate(data[i].date)}</text>)}
      {active !== null && hovered && <g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={top} y2={bottom} className="os-rec-hoverline" /><circle cx={x(active)} cy={y(hovered.net)} r="4" fill={bars ? "var(--sd-ink)" : "var(--sd-accent)"} stroke="var(--sd-white)" strokeWidth="2" /></g>}
      {data.map((d, i) => <rect key={`hit-${d.date}-${i}`} x={Math.max(left, x(i) - span / Math.max(2, 2 * (data.length - (bars ? 0 : 1))))} y={top} width={Math.min(right - Math.max(left, x(i) - span / Math.max(2, 2 * (data.length - (bars ? 0 : 1)))), span / Math.max(1, data.length - (bars ? 0 : 1)))} height={bottom - top} fill="transparent" onMouseEnter={() => setActive(i)} />)}
    </svg>
    {hovered && <div className="os-rec-chart-tip" role="status">{shortDate(hovered.date)} · <strong>{usd(hovered.net, true)}</strong> · {hovered.count} {hovered.count === 1 ? "trade" : "trades"}</div>}
  </div>;
}

export function Performance({ trades }: { trades: TradeRecord[] }) {
  const [account, setAccount] = useState("");
  const accounts = [...new Map(trades.map((r) => [r.accountId, r.accountLabel]))];
  const current = accounts.some(([id]) => id === account) ? account : "";
  const rows = current ? trades.filter((r) => r.accountId === current) : trades;
  const days = dailyTotals(rows);
  let sum = 0;
  const curve = days.map((d) => ({ ...d, net: sum += d.net }));
  if (curve.length) curve.unshift({ date: eatDay(Date.parse(`${curve[0].date}T12:00:00Z`) - 864e5), net: 0, count: 0 });
  const daily = dailyTotals(trades).slice(-30);
  return <div className="os-rec-chart-grid">
    <article className="os-rec-card os-rec-chart-card">
      <div className="os-rec-card-head"><div><h3>Realized equity curve</h3><p>Cumulative net P&L from closed trades</p></div><select className="form-select form-select-sm" aria-label="Equity account" value={current} onChange={(e) => setAccount(e.target.value)}><option value="">All accounts</option>{accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      <div className="os-rec-equity"><strong className={tone(sum)}>{usd(sum, true)}</strong><span>USD · selected period</span></div>
      <Chart data={curve} />
    </article>
    <article className="os-rec-card os-rec-chart-card">
      <div className="os-rec-card-head"><div><h3>Daily net P&L</h3><p>Last {daily.length || 30} trading days in range · EAT</p></div><span className="os-rec-icon os-rec-orange"><ChartNoAxesColumn size={17} /></span></div>
      <div className="os-rec-chart-key"><span><i /> Profit</span><span><i /> Loss</span></div>
      <Chart data={daily} bars />
    </article>
  </div>;
}

export function Distribution({ trades }: { trades: TradeRecord[] }) {
  const rs = trades.map(ratio).filter((r): r is number => r !== null);
  const intervals = [-Infinity, -1.5, -0.75, 0, 0.75, 1.5, 2.5, Infinity];
  const labels = ["<−1.5", "−1.5", "−0.75", "0", "+0.75", "+1.5", "2.5+"];
  const bins = labels.map((label, index) => ({ label, count: rs.filter((r) => r >= intervals[index] && r < intervals[index + 1]).length }));
  const tallest = Math.max(1, ...bins.map((b) => b.count));
  const months = [...new Set(trades.map((r) => eatDay(r.closedAt).slice(0, 7)))].sort().slice(-6);
  const symbols = [...new Set(trades.map((r) => r.symbol))].sort();
  return <div className="os-rec-chart-grid os-rec-even">
    <article className="os-rec-card os-rec-chart-card"><div className="os-rec-card-head"><div><h3>R-multiple distribution</h3><p>Net result divided by initial USD risk · {rs.length} trades with risk data</p></div><span className="os-rec-icon os-rec-violet"><Percent size={16} /></span></div>
      {rs.length ? <div className="os-rec-hist">{bins.map((bin, i) => <div className="os-rec-hist-bin" key={bin.label}><small>{bin.count}</small><span className={i < 3 ? "os-rec-bar-down" : "os-rec-bar-up"} style={{ height: `${Math.max(2, 115 * bin.count / tallest)}px` }} /><span title={`${bin.count} trades in this interval`}>{bin.label}</span></div>)}</div> : <div className="os-rec-empty">No initial risk values in this range.</div>}
    </article>
    <article className="os-rec-card os-rec-chart-card"><div className="os-rec-card-head"><div><h3>By-symbol heatmap</h3><p>Monthly realized P&L in USD · last six months with trades</p></div><span className="os-rec-icon os-rec-orange"><Grid2X2 size={16} /></span></div>
      {months.length ? <div className="os-rec-scroll"><table className="table os-rec-table os-rec-heat"><thead><tr><th>Instrument</th>{months.map((m) => <th key={m}>{new Date(`${m}-02T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}</th>)}</tr></thead><tbody>{symbols.map((symbol) => <tr key={symbol}><th>{symbol}</th>{months.map((m) => { const rows = trades.filter((r) => r.symbol === symbol && eatDay(r.closedAt).startsWith(m)); const value = rows.reduce((n, r) => n + netPnl(r), 0); return <td key={m}><span className={tone(value)}>{rows.length ? usd(value, true, 0) : "—"}</span></td>; })}</tr>)}</tbody></table></div> : <div className="os-rec-empty">No symbols in this range.</div>}
    </article>
  </div>;
}
