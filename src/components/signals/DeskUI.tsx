import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bitcoin,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Copy,
  FileSpreadsheet,
  Layers3,
  Mail,
  Send,
  SquareTerminal,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SourceKey } from "@/services/signalDesk";

export const sourceNames: Record<SourceKey, string> = {
  paste: "Paste console",
  telegram: "Telegram",
  webhook: "TradingView",
  email: "Email relay",
  csv: "CSV import",
  copyfactory: "CopyFactory",
};
const icons: Record<SourceKey, LucideIcon> = {
  paste: SquareTerminal,
  telegram: Send,
  webhook: Webhook,
  email: Mail,
  csv: FileSpreadsheet,
  copyfactory: Layers3,
};
export function SourceMark({
  source,
  small = false,
}: {
  source: SourceKey;
  small?: boolean;
}) {
  const Icon = icons[source];
  return (
    <span
      className={`os-source-mark os-tint-${source}${small ? " os-mark-sm" : ""}`}
    >
      <Icon size={small ? 14 : 19} strokeWidth={1.8} aria-hidden />
    </span>
  );
}
export function InstrumentMark({
  symbol,
  small = false,
}: {
  symbol: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`os-instrument-mark os-asset-${symbol === "XAUUSD" ? "gold" : symbol.includes("BTC") ? "btc" : symbol.includes("EUR") ? "eur" : symbol.startsWith("R_") ? "syn" : "other"}${small ? " os-instrument-small" : ""}`}
    >
      {symbol === "XAUUSD" ? (
        <svg viewBox="0 0 40 40" width="33" height="33" fill="none">
          <path d="m13 18 3-8h9l3 8z" fill="var(--os-gold-plane-1)" />
          <path d="m16 10 2-2h8l-1 2z" fill="var(--os-gold-plane-2)" />
          <path d="m25 10 1-2 4 8-2 2z" fill="var(--os-gold-plane-3)" />
          <path d="m4 29 3-8h11l3 8z" fill="var(--os-gold-plane-4)" />
          <path d="m7 21 2-2h10l-1 2z" fill="var(--os-gold-plane-5)" />
          <path d="m18 21 1-2 4 8-2 2z" fill="var(--os-gold-plane-6)" />
          <path d="m22 29 3-8h9l3 8z" fill="var(--os-gold-plane-7)" />
          <path d="m25 21 2-2h8l-1 2z" fill="var(--os-gold-plane-8)" />
          <path d="m34 21 1-2 4 8-2 2z" fill="var(--os-gold-plane-9)" />
        </svg>
      ) : symbol.includes("BTC") ? (
        <Bitcoin size={small ? 18 : 24} />
      ) : symbol.includes("EUR") ? (
        <b>&euro;</b>
      ) : symbol.startsWith("R_") ? (
        <ChartNoAxesCombined size={small ? 16 : 22} />
      ) : (
        <b>{symbol.slice(0, 2)}</b>
      )}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`os-status os-status-${value.toLowerCase()}`}>
      <i />
      {value}
    </span>
  );
}
export function PanelTitle({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="os-panel-title">
      <div className="os-title-main">
        <Icon size={18} strokeWidth={1.8} />
        <h2>{title}</h2>
      </div>
      {sub && <span className="os-title-sub">{sub}</span>}
      {action && <div className="os-title-action">{action}</div>}
    </div>
  );
}
export function Dialog({
  title,
  overline,
  description,
  children,
  onClose,
  wide = false,
  locked = false,
}: {
  title: string;
  overline?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog.showModal) dialog.showModal();
    else dialog.open = true;
    return () => {
      dialog.close?.();
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`os-desk-dialog${wide ? " os-dialog-wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <header className="os-dialog-header">
        <div>
          {overline && <span className="os-overline">{overline}</span>}
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="os-square-btn"
          aria-label="Close dialog"
          disabled={locked}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  return (
    <>
      <button
        type="button"
        className="os-soft-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setFallback(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
        {copied ? "Copied" : label}
      </button>
      {fallback && (
        <label className="os-field">
          Select and copy
          <input
            readOnly
            value={text}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </label>
      )}
    </>
  );
}
export const formatPnl = (n: number) =>
  `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function GuideDialog({
  onClose,
  onTry,
}: {
  onClose: () => void;
  onTry: () => void;
}) {
  return (
    <Dialog
      title="Your Signal Desk guide"
      overline="WORKSPACE HANDBOOK"
      description="From a provider message to a traceable paper fill."
      onClose={onClose}
    >
      <div className="os-dialog-body os-guide-steps">
        {[
          [
            "Paste a signal",
            "Paste plain text or a TradingView JSON alert. The local parser recognizes symbols, sides, entries, stops, and up to three targets.",
          ],
          [
            "Review the order",
            "Check the parsed card. Use Edit order to change any value. Missing or ambiguous fields are flagged, never silently executed.",
          ],
          [
            "Choose your route",
            "Stage for later or select Review order. Choose one or more accounts, inspect size and spread, then explicitly confirm.",
          ],
          [
            "Follow the receipt",
            "Paper market orders fill locally and appear in positions and Records. Broker routes are previews; no live instruction is sent.",
          ],
        ].map(([title, text], i) => (
          <div key={title}>
            <b>{String(i + 1).padStart(2, "0")}</b>
            <section>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          </div>
        ))}
      </div>
      <footer className="os-dialog-foot">
        <span>
          <CircleHelp size={14} /> Ctrl / Cmd + Enter parses your input.
        </span>
        <button type="button" className="os-action-primary" onClick={onTry}>
          Try a sample <ArrowUpRight size={15} />
        </button>
      </footer>
    </Dialog>
  );
}
