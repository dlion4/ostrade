import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, CircleSlash, Eye, Filter, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import type { PreviewRow, RuleDraft } from "@/services/automation";
import { SourceBadge } from "./AutomationUI";

export function PreviewPanel({
  draft, preview, onOpenBuilder,
}: {
  draft: RuleDraft;
  preview: PreviewRow[];
  onOpenBuilder: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "execute" | "skip">("all");
  const [expanded, setExpanded] = useState<string | null>(preview[0]?.signal.id ?? null);
  const visible = useMemo(() => preview.filter((row) => filter === "all" || (filter === "execute" ? row.decision === "EXECUTE" : row.decision === "SKIP")).slice(0, 20), [preview, filter]);
  const execute = preview.filter((row) => row.decision === "EXECUTE").length;
  const orders = preview.reduce((sum, row) => sum + row.orders.length, 0);
  const totalRisk = preview.filter((row) => row.decision === "EXECUTE").reduce((sum, row) => sum + row.orders.reduce((inner, order) => inner + order.riskUsd, 0), 0);
  return <section className="os-auto-panel os-auto-preview-panel" aria-labelledby="auto-preview-heading">
    <header className="os-auto-panel-head">
      <div><span className="os-auto-eyebrow">05 · ACTION MAPPING PREVIEW</span><h2 id="auto-preview-heading">Would this rule fire?</h2><p>Every decision against the last {preview.length} signals from the desk. Nothing here places an order.</p></div>
      <button type="button" className="os-auto-secondary" onClick={onOpenBuilder}><Eye size={14}/> Edit conditions</button>
    </header>
    <div className="os-auto-preview-stats">
      <div><span>Would execute</span><b className="os-up">{execute}</b></div>
      <div><span>Would skip / block</span><b>{preview.length - execute}</b></div>
      <div><span>Order legs</span><b>{orders}</b></div>
      <div><span>Plan risk</span><b>${totalRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}</b></div>
    </div>
    <div className="os-auto-preview-toolbar"><div className="os-auto-seg" role="group" aria-label="Filter decision preview">{([['all','All signals'],['execute','Execute'],['skip','Skip / block']] as const).map(([key,label]) => <button type="button" key={key} className={filter === key ? "is-on" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div><span className="os-auto-muted"><Filter size={12}/> rule: {draft.name || "Untitled"}</span></div>
    <div className="os-auto-preview-list">{visible.length === 0 ? <div className="os-auto-empty"><CircleSlash size={22}/><b>No signals in this filter</b><p>Clear the filter to see the full decision trail.</p><button type="button" className="os-auto-secondary" onClick={() => setFilter("all")}>Show all signals</button></div> : visible.map((row) => {
      const isOpen = expanded === row.signal.id;
      const rowRisk = row.orders.reduce((sum, order) => sum + order.riskUsd, 0);
      return <article key={row.signal.id} className={`os-auto-preview-row is-${row.decision.toLowerCase()}${isOpen ? " is-open" : ""}`}>
        <button type="button" className="os-auto-preview-main" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : row.signal.id)}>
          <span className="os-auto-preview-icon">{row.decision === "EXECUTE" ? <CheckCircle2 size={17}/> : <XCircle size={17}/>}</span>
          <span className="os-auto-preview-signal"><b>{row.signal.symbol} {row.signal.side}</b><small>{row.signal.id} · {row.signal.feed} · {row.signal.receivedLabel}</small></span>
          <SourceBadge source={row.signal.source} compact/>
          <span className={`os-auto-preview-result is-${row.decision.toLowerCase()}`}>{row.decision === "EXECUTE" ? "WOULD EXECUTE" : row.guard === "BLOCKED" ? "BLOCKED" : "WOULD SKIP"}</span>
          <span className="os-auto-preview-risk">{row.decision === "EXECUTE" ? `$${rowRisk.toFixed(0)} risk` : row.signal.confidence + "% parse"}</span>
          <ChevronDown size={15} className={isOpen ? "os-chevron-open" : ""} aria-hidden/>
        </button>
        {isOpen && <div className="os-auto-preview-detail"><p><ShieldAlert size={13}/>{row.reason}</p>{row.orders.length > 0 && <div className="os-auto-order-lines">{row.orders.map((order) => <div key={`${row.signal.id}-${order.accountId}`}><b>{order.accountLabel}</b><span className="os-auto-mono">{order.symbol} · {order.size} {order.unit} · SL {order.sl || "none"} · TP {order.tp || "none"}</span><em className={`os-auto-order-mode is-${order.mode.toLowerCase()}`}>{order.mode}</em></div>)}</div>}</div>}
      </article>;
    })}</div>
    <footer className="os-auto-panel-foot"><span><Sparkles size={13}/> Exact mapping, not a promise of a fill.</span><button type="button" className="os-auto-text-button" onClick={onOpenBuilder}>Back to the builder <ArrowRight size={13}/></button></footer>
  </section>;
}
