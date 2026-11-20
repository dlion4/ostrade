import { useEffect, useId, useRef, type ReactNode } from "react";
import { Banknote, Bitcoin, Building2, CircleAlert, CircleCheck, CreditCard, FlaskConical, LockKeyhole, ReceiptText, Repeat2, Smartphone, X } from "lucide-react";
import { fundingRails, type DepositRailId, type DepositRecord } from "@/services/deposits";

export const railIcons = { paper: FlaskConical, "mpesa-agent": Smartphone, cashier: Banknote, crypto: Bitcoin, manual: ReceiptText, ach: Building2, wire: CreditCard, internal: Repeat2 };
export const amountLabel = (value: number, currency = "USD") => `${currency === "USD" ? "$" : `${currency} `}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const whole = (value: number, currency: string) => `${currency === "USD" ? "$" : `${currency} `}${value.toLocaleString("en-US")}`;
export const eat = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
export const eatDay = (iso: string | Date) => new Date(new Date(iso).getTime() + 10_800_000).toISOString().slice(0,10);
export const errorText = (e: unknown) => e instanceof Error ? e.message : "The local operation could not complete. Try again.";
export const timingLabel = (n: number) => n === 0 ? "Instant" : n >= 1440 ? `${+(n / 1440).toFixed(1)} days` : n >= 60 ? `${+(n / 60).toFixed(1)} hr` : `${n} min`;
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "orange" | "red" | "blue" | "violet" }) { return <span className={`os-dep-badge os-dep-tone-${tone}`}>{children}</span>; }
export function DepositStatusBadge({ row }: { row: DepositRecord }) {
  if (row.origin === "Preview") return <Badge tone="blue">Ready · offline</Badge>;
  if (row.origin === "Simulated") return <Badge tone="green"><CircleCheck size={12} /> Simulated credit</Badge>;
  return <Badge tone={row.status === "CONFIRMED" ? "green" : row.status === "PENDING" ? "orange" : row.status === "FAILED" ? "red" : "neutral"}>{row.status === "PENDING" && <i className="os-dep-pulse" />}{row.status[0]}{row.status.slice(1).toLowerCase()}</Badge>;
}
export function MethodDetails({ details, currency }: { details: DepositRecord["details"]; currency: string }) {
  if (!details) return null;
  const fields = details.rail === "mpesa-agent" ? [["Sample agent", details.agentLabel], ["Masked sample phone", details.maskedPhone]]
    : details.rail === "cashier" ? [["Matching window", `${details.matchingWindowMinutes} min`]]
    : details.rail === "manual" || details.rail === "wire" ? [["Broker portal method", details.method], ["Expected credit (unverified)", amountLabel(details.expectedCredit, currency)]]
    : details.rail === "ach" ? [["Sample bank", details.bankLabel]]
    : details.rail === "internal" ? [["Sample source wallet", details.wallet]] : [];
  return <>{fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</>;
}
export function RailTag({ rail }: { rail: DepositRailId }) { const Icon = railIcons[rail]; return <span className="os-dep-rail-tag"><Icon size={15} />{fundingRails[rail].title}</span>; }
export function Note({ children, danger = false }: { children: ReactNode; danger?: boolean }) { return <div className={`os-dep-note${danger ? " os-dep-note-danger" : ""}`} role={danger ? "alert" : "status"}>{danger ? <CircleAlert size={16} /> : <LockKeyhole size={15} />}<div>{children}</div></div>; }
export function Busy({ children }: { children: ReactNode }) { return <span className="os-dep-busy" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" />{children}</span>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="os-dep-empty">{children}</div>; }
export function Dialog({ title, kicker, close, children, drawer = false }: { title: string; kicker: string; close: () => void; children: ReactNode; drawer?: boolean }) {
  const node = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    const modal = node.current, active = document.activeElement as HTMLElement | null;
    modal?.showModal(); return () => { modal?.close(); if (active?.isConnected) active.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={node} className={`os-dep-dialog${drawer ? " os-dep-drawer" : ""}`} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}><div className="os-dep-dialog-inner"><header><div><span className="os-dep-kicker">{kicker}</span><h2 id={id}>{title}</h2></div><button type="button" className="btn os-dep-btn os-dep-square" onClick={close} aria-label="Close dialog"><X size={18} /></button></header>{children}</div></dialog>;
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export async function copyText(value: string) { await navigator.clipboard.writeText(value); }
