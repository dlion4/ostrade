import { useState } from "react";
import { ArrowRight, BarChart3, CalendarRange, Check, ChevronDown, FlaskConical, Loader2, ShieldAlert, Sparkles, TriangleAlert, Zap } from "lucide-react";
import type { DryRunReport, RuleDraft } from "@/services/automation";
import { InlineNotice } from "./AutomationUI";

export function DryRunPanel({
  draft, report, days, setDays, running, onRun, onPromote, readOnly = false,
}: {
  draft: RuleDraft;
  report: DryRunReport | null;
  days: number;
  setDays: (days: number) => void;
  running: boolean;
  onRun: () => void;
  onPromote: () => void;
  readOnly?: boolean;
}) {
  const [showRows, setShowRows] = useState(false);
  const maxAllocation = Math.max(1, ...(report?.accounts.map((account) => account.allocationUsd) ?? [1]));
  return <section className="os-auto-panel os-auto-dryrun" id="dry-run" aria-labelledby="auto-dryrun-heading">
    <header className="os-auto-panel-head">
      <div><span className="os-auto-eyebrow">06 · SIMULATION &amp; DRY RUN</span><h2 id="auto-dryrun-heading">Trust it before you activate it</h2><p>Replay the rule over stored signals. A dry run changes no positions, no ledger, and no live state.</p></div>
      <div className="os-auto-dryrun-controls"><label className="os-auto-select"><CalendarRange size={13}/><select aria-label="Dry run window" value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={running}><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label><button type="button" className="os-auto-primary" disabled={running} onClick={onRun}>{running ? <Loader2 size={14} className="os-spin"/> : <FlaskConical size={14}/>} {running ? "Replaying signals…" : "Run dry run"}</button></div>
    </header>
    <div className="os-auto-dryrun-rule"><div><span className="os-auto-chip-label">RULE</span><b>{draft.name || "Untitled draft"}</b><small>{draft.symbols.join(" / ") || "Any instrument"} · {draft.sources.join(" + ")}</small></div><span className={`os-auto-rule-state is-${draft.status === "active" ? "active" : "draft"}`}><i />{draft.status === "active" ? "Active" : "Draft"}</span></div>
    {!report ? <div className="os-auto-dryrun-empty"><FlaskConical size={30}/><b>No dry run yet for this rule</b><p>Run {days === 1 ? "the last 24 hours" : `the last ${days} days`} against stored signals to see hypothetical fills, guard hits, and per-account allocation.</p><button type="button" className="os-auto-secondary" disabled={running} onClick={onRun}>Run the {days}-day simulation <ArrowRight size={13}/></button></div> : <>
      <div className="os-auto-dryrun-summary">
        <div className="os-auto-dryrun-kpi"><span>Evaluated</span><b>{report.evaluated}</b><small>signals in window</small></div>
        <div className="os-auto-dryrun-kpi"><span>Would execute</span><b className="os-up">{report.executed}</b><small>{report.winCount} winners · {report.lossCount} losers</small></div>
        <div className="os-auto-dryrun-kpi"><span>Guard blocks</span><b className="os-auto-warn">{report.blocked}</b><small>{report.skipped} skipped by conditions</small></div>
        <div className="os-auto-dryrun-kpi"><span>Hypothetical P&amp;L</span><b className={report.hypotheticalPnl >= 0 ? "os-up" : "os-down"}>{report.hypotheticalPnl >= 0 ? "+" : "−"}${Math.abs(report.hypotheticalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><small>{report.executed ? `${((report.winCount / Math.max(1, report.executed)) * 100).toFixed(0)}% win rate` : "No fills"}</small></div>
      </div>
      <div className="os-auto-dryrun-main">
        <div className="os-auto-allocation"><div className="os-auto-subhead"><span><BarChart3 size={13}/> Per-account allocation</span><span className="os-auto-muted">${report.allocation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} planned risk</span></div>{report.accounts.length === 0 ? <p className="os-auto-muted">No account would receive an allocation.</p> : report.accounts.map((account) => <div className="os-auto-allocation-row" key={account.accountId}><span>{account.label}<small>{account.trades} leg{account.trades === 1 ? "" : "s"} · {account.environment === "paper" ? "SIMULATED" : "PREVIEW"}</small></span><div className="os-auto-allocation-bar"><i style={{ width: `${(account.allocationUsd / maxAllocation) * 100}%` }}/></div><b className="os-auto-mono">${account.allocationUsd.toFixed(2)}</b><em className={account.pnl >= 0 ? "os-up" : "os-down"}>{account.pnl >= 0 ? "+" : "−"}${Math.abs(account.pnl).toFixed(2)}</em></div>)}</div>
        <div className="os-auto-dryrun-notes"><div className="os-auto-subhead"><span><ShieldAlert size={13}/> What the simulation found</span></div><ul><li><Check size={13}/> No live orders, positions, or ledger entries were created.</li><li><Check size={13}/> Stop and target conversions used each account's precision.</li><li><TriangleAlert size={13}/> Static desk signals cannot model slippage, gaps, or broker rejections.</li><li><Check size={13}/> The 30-day sample window is bounded by the local mock feed.</li></ul></div>
      </div>
      <div className="os-auto-dryrun-foot"><button type="button" className="os-auto-text-button" onClick={() => setShowRows((value) => !value)}>{showRows ? "Hide decision sample" : "View decision sample"} <ChevronDown size={13}/></button>{!readOnly && <button type="button" className="os-auto-secondary" onClick={onPromote} disabled={running}><Zap size={14}/> Promote to active rule</button>}</div>
      {showRows && <div className="os-auto-dryrun-rows">{report.rows.map((row) => <div key={row.signal.id} className={`is-${row.decision.toLowerCase()}`}><span className="os-auto-mono">{row.signal.id}</span><b>{row.signal.symbol} {row.signal.side}</b><span>{row.decision === "EXECUTE" ? `${row.orders.length} leg${row.orders.length === 1 ? "" : "s"}` : row.reason}</span><em>{row.decision}</em></div>)}</div>}
    </>}
    <InlineNotice tone="info"><Sparkles size={15}/> The report is a simulation against the desk snapshot, not a broker backtest. Hypothetical P&amp;L is illustrative.</InlineNotice>
  </section>;
}
