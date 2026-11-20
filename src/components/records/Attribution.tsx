import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Network } from "lucide-react";
import type { TradeRecord } from "@/services/records";
import { SourceLink } from "./History";
import { summarize, tone, usd } from "./recordsView";

const colors = ["#e9672e", "#7883c7", "#36a479", "#4f9cb4", "#c88650", "#be6683", "#8a80a7", "#819185", "#c75843", "#99a3ad"];
type Sort = "sourceName" | "count" | "winRate" | "net" | "profitFactor";
export function Attribution({ trades }: { trades: TradeRecord[] }) {
  const [sort, setSort] = useState<{ key: Sort; desc: boolean }>({ key: "net", desc: true });
  const [group, setGroup] = useState("Source");
  const data = useMemo(() => {
    const groups = new Map<string, TradeRecord[]>();
    for (const r of trades) {
      const key = group === "Method" ? r.source : `${r.source}:${r.sourceName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.values()].map((list) => ({ ...list[0], sourceName: group === "Method" ? list[0].source : list[0].sourceName, count: list.length, ...summarize(list) })).sort((a, b) => b.net - a.net).map((row, i) => ({ ...row, color: colors[i % colors.length] }));
  }, [trades, group]);
  const ordered = data.slice().sort((a, b) => (sort.desc ? -1 : 1) * (sort.key === "sourceName" ? a.sourceName.localeCompare(b.sourceName) : (a[sort.key] ?? 0) === (b[sort.key] ?? 0) ? 0 : (a[sort.key] ?? 0) > (b[sort.key] ?? 0) ? 1 : -1));
  let offset = 0;
  const stops = data.map((row) => { const from = offset; offset += row.count / trades.length * 100; return `${row.color} ${from}% ${offset}%`; });
  const max = Math.max(1, ...data.map((row) => Math.abs(row.net)));
  return <div className="os-rec-card os-rec-attribution">
    <div className="os-rec-card-head"><div><h3>Source contribution</h3><p>Compare net P&L, win rate and sample size before changing a source.</p></div><div className="os-rec-segments" role="group" aria-label="Attribution grouping">{["Source", "Method"].map((item) => <button key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}</div></div>
    {!data.length ? <div className="os-rec-empty">No source activity in this range.</div> : <>
      <div className="os-rec-attribution-viz">
        <div className="os-rec-donut-wrap"><div className="os-rec-donut" style={{ background: `conic-gradient(${stops.length === 1 ? `${data[0].color}, ${data[0].color}` : stops.join(",")})` }} role="img" aria-label={`Trade mix across ${data.length} groups`}><div><strong>{trades.length}</strong><small>closed trades</small></div></div><div><strong>Execution mix</strong><small>{data.length} {group === "Source" ? "sources" : "methods"} in this period</small></div></div>
        <div className="os-rec-attribution-bars">{data.slice(0, 5).map((row) => <div key={`${row.source}:${row.sourceName}`}><span>{row.sourceName}</span><span className="os-rec-rail"><i style={{ width: `${Math.abs(row.net) / max * 100}%`, background: row.net < 0 ? "var(--sd-red)" : row.color }} /></span><strong className={tone(row.net)}>{usd(row.net, true, 0)}</strong></div>)}</div>
      </div>
      <div className="os-rec-scroll"><table className="table os-rec-table"><thead><tr>{([["sourceName", "Source"], ["count", "Trades"], ["winRate", "Win rate"], ["net", "Net P&L"], ["profitFactor", "Profit factor"]] as const).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.desc ? "descending" : "ascending" : undefined}><button className="os-rec-text-btn" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : key !== "sourceName" })}>{label}{sort.key === key ? sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : <ArrowUpDown size={11} className="os-rec-sort" />}</button></th>)}<th>Suggestion</th></tr></thead>
        <tbody>{ordered.map((row) => { const verdict = row.count < 10 ? "MONITOR" : (row.profitFactor ?? 0) >= 1.5 ? "KEEP" : (row.profitFactor ?? 0) < 0.9 ? "MUTE" : "MONITOR"; return <tr key={`${row.source}:${row.sourceName}`}><td><span className="os-rec-source-name"><i style={{ background: row.color }} />{group === "Method" ? row.sourceName : <SourceLink trade={row} />}</span>{group === "Source" && <small className="os-rec-cell-sub">{row.source}{row.source === "Schedule" ? " · open to pause" : row.source === "Automation" ? " · open to adjust routing" : ""}</small>}</td><td>{row.count}</td><td>{row.winRate.toFixed(1)}%</td><td className={`fw-semibold ${tone(row.net)}`}>{usd(row.net, true)}</td><td>{row.profitFactor === Infinity ? "∞" : row.profitFactor?.toFixed(2) ?? "—"}</td><td><span className={`os-rec-pill ${verdict === "KEEP" ? "os-rec-green" : verdict === "MUTE" ? "os-rec-rose" : "os-rec-orange"}`}>{verdict}</span>{group === "Source" && verdict === "MUTE" && row.ruleRef && <Link className="os-rec-source ms-2" to="/dashboard/automation" search={{ recordSource: row.ruleRef }}>Review rule</Link>}</td></tr>; })}</tbody></table></div>
      <div className="os-rec-table-foot"><span><Network size={14} /> Suggestions are descriptive, not automatic. Fewer than 10 trades → Monitor.</span></div>
    </>}
  </div>;
}
