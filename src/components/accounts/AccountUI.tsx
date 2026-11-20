import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, CircleAlert, FlaskConical, LockKeyhole, Minus, X } from "lucide-react";
import { providerCapabilities, type BrokerKey, type Capability, type TradingAccount } from "@/services/accounts";

export const names: Record<BrokerKey, string> = { paper: "OStrade Paper", deriv: "Deriv", exness: "Exness / MT5", alpaca: "Alpaca", ctrader: "cTrader", binance: "Binance", oanda: "OANDA", icmarkets: "IC Markets", pepperstone: "Pepperstone", xm: "XM" };
const marks: Record<BrokerKey, string> = { paper: "", deriv: "d", exness: "ex", alpaca: "A", ctrader: "cT", binance: "B", oanda: "O", icmarkets: "IC", pepperstone: "P", xm: "XM" };
export const dollars = (n: number, currency = "USD", sign = false) => `${sign && n > 0 ? "+" : ""}${currency === "USDT" ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT` : n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const eatDate = (at: string) => new Date(at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
export const accountTag = (a: TradingAccount) => a.broker === "paper" ? "SIMULATED" : a.environment === "live-ready" ? "LIVE PREVIEW" : a.environment === "paper" ? "PAPER SNAPSHOT" : "DEMO SNAPSHOT";
export const errorText = (e: unknown) => e instanceof Error ? e.message : "Something went wrong. Try again.";
export function BrokerMark({ broker, compact = false }: { broker: BrokerKey; compact?: boolean }) {
  return <span aria-hidden="true" className={`os-hub-mark os-hub-mark-${broker}${compact ? " os-hub-mark-sm" : ""}`}>
    {broker === "paper" ? <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><path d="m2 16 5-10h4L6 16zM8 19l8-16h4l-8 16zM15 19l5-10h4l-5 10z" /></svg> : marks[broker]}
  </span>;
}
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "orange" | "red" | "blue" }) {
  return <span className={`os-hub-chip os-hub-tone-${tone}`}>{children}</span>;
}
export function StateNote({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`os-hub-note${error ? " os-hub-note-error" : ""}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={16} /> : <LockKeyhole size={15} />}<div>{children}</div></div>;
}
export function Busy({ children }: { children: ReactNode }) { return <span className="os-hub-busy" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {children}</span>; }
export function Dialog({ title, kicker, children, close, drawer = false }: { title: string; kicker: string; children: ReactNode; close: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current, active = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (active?.isConnected) active.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} className={`os-hub-dialog${drawer ? " os-hub-dialog-drawer" : ""}`} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}><div className="os-hub-dialog-body">
    <header><div><span className="os-hub-eyebrow">{kicker}</span><h2 id={id}>{title}</h2></div><button className="btn os-hub-btn os-hub-icon-btn" aria-label="Close dialog" onClick={close}><X size={18} /></button></header>{children}
  </div></dialog>;
}
export function CapabilityTags({ broker, details = false }: { broker: BrokerKey; details?: boolean }) {
  const caps = providerCapabilities(broker).filter((c) => details || ["market", "modify", "deposit", "transfer"].includes(c.id));
  const compact: Record<string, string> = { market: "Trade", modify: "Modify", deposit: "Deposit API", transfer: "Transfer" };
  return <div className={`os-hub-capabilities${details ? " os-hub-capabilities-full" : ""}`}>{caps.map((c: Capability) => <span title={c.note ?? (c.v === "yes" ? "Supported by adapter" : "Unavailable")} key={c.id} data-cap={c.v} aria-label={`${c.label}: ${c.v === "partial" ? c.note ?? "Conditional" : c.v === "yes" ? "Supported" : "Unavailable"}`}>
    {c.v === "yes" ? <Check size={12} /> : c.v === "partial" ? <FlaskConical size={12} /> : <Minus size={12} />}{details ? c.label : compact[c.id]}{details && c.note && <small>{c.note}</small>}
  </span>)}</div>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="os-hub-empty">{children}</div>; }
