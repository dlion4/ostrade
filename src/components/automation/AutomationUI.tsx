import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, Copy, Info, ShieldAlert, X } from "lucide-react";
import type { SourceKey } from "@/data/signalDesk";
import type { AuditDecision } from "@/services/automation";

export const automationSourceLabel: Record<SourceKey, string> = {
  telegram: "Telegram",
  webhook: "TradingView",
  copyfactory: "CopyFactory",
  email: "Email relay",
  paste: "Paste console",
  csv: "Statement import",
};

export const automationSourceInitial: Record<SourceKey, string> = {
  telegram: "TG",
  webhook: "TV",
  copyfactory: "CF",
  email: "EM",
  paste: "PC",
  csv: "CSV",
};

export function SourceBadge({ source, channel, compact = false }: { source: SourceKey; channel?: string; compact?: boolean }) {
  return (
    <span className={`os-auto-source is-${source}${compact ? " is-compact" : ""}`} title={channel ? `${automationSourceLabel[source]} · ${channel}` : automationSourceLabel[source]}>
      <i aria-hidden>{automationSourceInitial[source]}</i>
      <span>{automationSourceLabel[source]}</span>
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: AuditDecision | "FILLED" | "SKIPPED" | "BLOCKED" | "DRAFT" | "ACTIVE" | "PAUSED" }) {
  const label = decision === "EXECUTED" ? "Executed" : decision === "DRY RUN" ? "Dry run" : decision === "OPERATOR" ? "Operator" : decision.charAt(0) + decision.slice(1).toLowerCase();
  const tone = ["EXECUTED", "FILLED", "ACTIVE"].includes(decision) ? "ok" : ["BLOCKED"].includes(decision) ? "danger" : ["DRY RUN", "DRAFT"].includes(decision) ? "violet" : "muted";
  return <span className={`os-auto-decision is-${tone}`}><i aria-hidden />{label}</span>;
}

export function RuleState({ enabled, status }: { enabled: boolean; status?: string }) {
  const label = enabled ? "Active" : status === "draft" ? "Draft" : "Paused";
  return <span className={`os-auto-rule-state is-${enabled ? "active" : status === "draft" ? "draft" : "paused"}`}><i aria-hidden />{label}</span>;
}

export function SparkBars({ values, tone = "orange" }: { values: number[]; tone?: "orange" | "green" | "red" }) {
  const max = Math.max(...values, 1);
  return <span className={`os-auto-spark is-${tone}`} aria-hidden>{values.map((value, index) => <i key={index} style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />)}</span>;
}

export function AutoDialog({
  title, overline, description, children, footer, onClose, locked = false, wide = false,
}: {
  title: string; overline?: string; description?: string; children: ReactNode; footer?: ReactNode;
  onClose: () => void; locked?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog.showModal) dialog.showModal(); else dialog.open = true;
    return () => { dialog.close?.(); document.body.style.overflow = previousOverflow; active?.focus(); };
  }, []);
  return <dialog
    ref={ref}
    className={`os-auto-dialog${wide ? " is-wide" : ""}`}
    aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}
    onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose(); }}
  >
    <header className="os-auto-dialog-head">
      <div>{overline && <span className="os-auto-overline">{overline}</span>}<h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
      <button type="button" className="os-auto-icon-button" aria-label="Close dialog" disabled={locked} onClick={onClose}><X size={18}/></button>
    </header>
    <div className="os-auto-dialog-body">{children}</div>
    {footer && <footer className="os-auto-dialog-foot">{footer}</footer>}
  </dialog>;
}

export function InlineNotice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "ok" | "danger"; children: ReactNode; icon?: ReactNode }) {
  return <div className={`os-auto-notice is-${tone}`} role={tone === "danger" ? "alert" : "status"}>
    {icon ?? (tone === "danger" ? <ShieldAlert size={16}/> : <Info size={16}/>)}<span>{children}</span>
  </div>;
}

export function CopyMini({ text, label = "Copy" }: { text: string; label?: string }) {
  return <button type="button" className="os-auto-copy" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard can be unavailable */ } }}><Copy size={12}/>{label}</button>;
}

export function CheckLine({ children }: { children: ReactNode }) {
  return <span className="os-auto-check-line"><Check size={13}/>{children}</span>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  return children ? <span className="os-auto-field-error" role="alert">{children}</span> : null;
}
