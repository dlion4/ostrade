import { Activity, Gauge, LockKeyhole, PauseCircle, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";
import type { RuleDraft } from "@/services/automation";
import { InlineNotice } from "./AutomationUI";

export function SafetyPanel({ activeCount, draft, halted, pausing, onPauseAll }: { activeCount: number; draft: RuleDraft; halted: boolean; pausing: boolean; onPauseAll: () => void }) {
  const guardCards = [
    { icon: LockKeyhole, title: "Kill switch", value: halted ? "ENGAGED" : "ARMED", detail: "The global kill switch always overrides every rule. It cannot be disabled from this page.", tone: halted ? "danger" : "ok" },
    { icon: Gauge, title: "Daily-loss circuit breaker", value: `${draft.dailyLossPct}%`, detail: "Once the attributed loss limit is crossed, the rule stops evaluating until it is re-armed.", tone: "warn" },
    { icon: SlidersHorizontal, title: "Trade burst limits", value: `${draft.maxTradesHour} / hr`, detail: `At most ${draft.maxOpenPositions} open-position contributions and a ${draft.dedupeMinutes}-minute duplicate window.`, tone: "info" },
    { icon: ShieldCheck, title: "Pre-trade pipeline", value: "7 checks", detail: "Session, capability, size, margin, guards, duplicate/price sanity, and the rule window all run before an order.", tone: "ok" },
  ] as const;
  return <section className="os-auto-panel os-auto-safety" aria-labelledby="auto-safety-heading">
    <header className="os-auto-panel-head">
      <div><span className="os-auto-eyebrow">08 · GUARDRAILS &amp; EXECUTION SAFETY</span><h2 id="auto-safety-heading">Automation never gets the last word</h2><p>The engine obeys the same risk pipeline as a manual signal desk order. It stops when any guard says stop.</p></div>
      <div className="d-flex flex-wrap gap-2 align-items-center"><span className="os-auto-live-local"><i/> Local engine · paper-first</span><button type="button" className="os-auto-secondary is-danger" disabled={pausing || activeCount === 0} onClick={onPauseAll}><PauseCircle size={14}/> {pausing ? "Pausing…" : `Pause ${activeCount} active`}</button></div>
    </header>
    <div className="os-auto-guard-cards">{guardCards.map((card) => { const Icon = card.icon; return <article key={card.title} className={`os-auto-guard-card is-${card.tone}`}><div className="os-auto-guard-icon"><Icon size={17}/></div><span>{card.title}</span><b>{card.value}</b><p>{card.detail}</p></article>; })}</div>
    <div className="os-auto-pipeline"><div className="os-auto-pipeline-head"><span><Activity size={14}/> PRE-TRADE CHECK PIPELINE</span><small>Every rule · every order</small></div><ol>{["Market session is open", "Broker supports the order kind", "Size is inside min / max", "Margin floor is respected", "Daily loss + exposure headroom", "Duplicate, storm & fat-finger checks", "Rule session window is valid"].map((label, index) => <li key={label}><b>{String(index + 1).padStart(2, "0")}</b><span>{label}</span><ShieldCheck size={13}/></li>)}</ol></div>
    <InlineNotice tone={halted ? "danger" : "warn"} icon={<Zap size={15}/>}>No rule can place a live broker order in this frontend-only build. Paper fills are simulated locally; broker targets resolve to a clearly labelled execution preview.</InlineNotice>
    <footer className="os-auto-panel-foot"><span><LockKeyhole size={13}/> Operator action required to pause or re-arm.</span><span className="os-auto-muted">Rule changes are written to the audit log.</span></footer>
  </section>;
}
