import { useMemo, useState } from "react";
import { ArrowDownUp, CalendarDays, Download, FileClock, FilterX, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuditDecision, AutomationAudit } from "@/services/automation";
import { auditToCsv } from "@/services/automation";
import { useToast } from "@/components/Toast";
import { DecisionBadge } from "./AutomationUI";

export function AuditLog({ events }: { events: AutomationAudit[] }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<"all" | AuditDecision>("all");
  const [range, setRange] = useState<"today" | "7d" | "30d">("today");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => {
    const start = range === "today" ? Date.UTC(2025, 2, 13, 21, 0) : Date.UTC(2025, 2, 14, 13, 40) - (range === "7d" ? 7 : 30) * 86_400_000;
    return events.filter((event) => event.timestamp >= start)
      .filter((event) => decision === "all" || event.decision === decision)
      .filter((event) => !query || `${event.ruleName} ${event.signalRef} ${event.symbol} ${event.reason}`.toLowerCase().includes(query.toLowerCase()))
      .sort((left, right) => sort === "newest" ? right.timestamp - left.timestamp : left.timestamp - right.timestamp);
  }, [events, decision, query, range, sort]);
  const visible = showAll ? filtered : filtered.slice(0, 8);
  const exportCsv = () => {
    const csv = auditToCsv(filtered);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ostrade-automation-audit.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${filtered.length} audit rows exported locally`);
  };
  const reset = () => { setQuery(""); setDecision("all"); setRange("today"); setSort("newest"); };
  const executed = filtered.filter((event) => event.decision === "EXECUTED").length;
  const blocked = filtered.filter((event) => event.decision === "BLOCKED").length;
  return <section className="os-auto-panel os-auto-audit" aria-labelledby="auto-audit-heading">
    <header className="os-auto-panel-head">
      <div><span className="os-auto-eyebrow">07 · RULE AUDIT LOG</span><h2 id="auto-audit-heading">Why did automation do that?</h2><p>Every evaluation is timestamped, traceable to a signal, and keeps the guard’s reason.</p></div>
      <button type="button" className="os-auto-secondary" onClick={exportCsv}><Download size={14}/> Export CSV</button>
    </header>
    <div className="os-auto-audit-summary"><span><ShieldCheck size={14}/><b>{executed}</b> executed</span><span><ShieldAlert size={14}/><b>{blocked}</b> blocked</span><span><FileClock size={14}/><b>{filtered.length}</b> decisions in view</span></div>
    <div className="os-auto-audit-toolbar">
      <label className="os-auto-search"><Search size={14}/><input aria-label="Search audit log" placeholder="Search rule, signal or reason…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <label className="os-auto-select">Decision <select aria-label="Filter audit by decision" value={decision} onChange={(event) => setDecision(event.target.value as "all" | AuditDecision)}><option value="all">All decisions</option><option value="EXECUTED">Executed</option><option value="SKIPPED">Skipped</option><option value="BLOCKED">Blocked</option><option value="DRY RUN">Dry run</option><option value="OPERATOR">Operator</option></select></label>
      <label className="os-auto-select"><CalendarDays size={13}/><select aria-label="Audit date range" value={range} onChange={(event) => setRange(event.target.value as typeof range)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
      <button type="button" className="os-auto-text-button" onClick={() => setSort((value) => value === "newest" ? "oldest" : "newest")}><ArrowDownUp size={13}/> {sort === "newest" ? "Newest first" : "Oldest first"}</button>
      {(query || decision !== "all" || range !== "today") && <button type="button" className="os-auto-text-button" onClick={reset}><FilterX size={13}/> Clear</button>}
    </div>
    {visible.length === 0 ? <div className="os-auto-empty"><FileClock size={24}/><b>No audit events in this view</b><p>Reset the filters or run a dry run to create an event.</p><button type="button" className="os-auto-secondary" onClick={reset}>Show today’s events</button></div> : <div className="os-auto-table-wrap"><table className="os-auto-table os-auto-audit-table"><thead><tr><th>Time (EAT)</th><th>Rule</th><th>Signal</th><th>Decision</th><th>Reason</th><th>Orders</th><th>Latency</th></tr></thead><tbody>{visible.map((event) => <tr key={event.id}><td data-label="Time" className="os-auto-mono">{event.timestampLabel}</td><td data-label="Rule"><b>{event.ruleName}</b><small>{event.accountLabels.join(" · ")}</small></td><td data-label="Signal" className="os-auto-mono">{event.signalRef}{event.symbol ? <small>{event.symbol}</small> : null}</td><td data-label="Decision"><DecisionBadge decision={event.decision}/></td><td data-label="Reason" className="os-auto-audit-reason">{event.reason}</td><td data-label="Orders" className="os-auto-mono">{event.orders.length ? event.orders.join(", ") : "—"}</td><td data-label="Latency" className="os-auto-mono">{event.latencyMs ? `${event.latencyMs} ms` : "—"}</td></tr>)}</tbody></table></div>}
    <footer className="os-auto-panel-foot"><span>{visible.length} of {filtered.length} decisions</span><button type="button" className="os-auto-text-button" disabled={filtered.length <= 8} onClick={() => setShowAll((value) => !value)}>{showAll ? "Show latest 8" : "Show all decisions"}</button></footer>
  </section>;
}
