import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Fingerprint,
  LoaderCircle,
  Mail,
  MessageCircle,
  Radio,
  ShieldAlert,
  Smartphone,
  Wallet,
  WifiOff,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type Channel,
  type Delivery,
  type Notice,
} from "@/services/notifications";

export const channelIcons = {
  "In-app": Bell,
  Email: Mail,
  SMS: MessageCircle,
  Push: Smartphone,
  Telegram: Radio,
};
export function eventIcon(event: Notice["event"]) {
  return event.startsWith("order")
    ? Zap
    : event.startsWith("schedule") || event === "news.reminder"
      ? CalendarClock
      : event.startsWith("margin") ||
          event === "killswitch.engaged" ||
          event === "guard.blocked"
        ? ShieldAlert
        : event.startsWith("deposit")
          ? ArrowDownLeft
          : event.startsWith("transfer") || event.startsWith("withdraw")
            ? Wallet
            : event.startsWith("broker")
              ? WifiOff
              : event.startsWith("adapter")
                ? Activity
                : event.startsWith("copilot")
                  ? Bot
                  : event.startsWith("rule")
                    ? Workflow
                    : event.startsWith("anomaly")
                      ? Fingerprint
                      : event.startsWith("tp.") || event.startsWith("sl.")
                        ? Crosshair
                        : Bell;
}
export function Button({
  kind = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`btn os-nt-btn os-nt-btn-${kind} ${className}`}
    />
  );
}
export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "teal" | "red" | "amber" | "blue";
  children: ReactNode;
}) {
  return <span className={`os-nt-tag os-nt-${tone}`}>{children}</span>;
}
export const toneFor = (severity: Notice["severity"]) =>
  severity === "Critical"
    ? "red"
    : severity === "Warning"
      ? "amber"
      : severity === "Finance"
        ? "blue"
        : "teal";
export const deliveryTone = (status: Delivery["status"]) =>
  status === "In inbox"
    ? "teal"
    : status === "Offline preview"
      ? "blue"
      : status === "Rate capped"
        ? "red"
        : "amber";
export function ChannelName({ channel }: { channel: Channel }) {
  const Icon = channelIcons[channel];
  return (
    <>
      <Icon size={13} aria-hidden="true" />
      {channel}
    </>
  );
}
export function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`os-nt-message ${error ? "os-nt-message-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
      <span>{children}</span>
    </div>
  );
}
export function Failure({ error }: { error: unknown }) {
  return error ? (
    <Message error>
      {error instanceof Error ? error.message : "Local operation unavailable."}
    </Message>
  ) : null;
}
export function Busy({
  children = "Reading local data…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="os-nt-empty" role="status">
      <LoaderCircle size={18} className="os-nt-spin" />
      {children}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="os-nt-empty">{children}</div>;
}
export function PanelHead({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className="os-nt-panel-head">
      <div>
        {eyebrow && <span className="os-nt-eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </div>
  );
}
export function Drawer({
  title,
  kicker,
  onClose,
  children,
  busy,
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      className="os-nt-dialog"
      ref={element}
      aria-labelledby="nt-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (!busy && e.currentTarget === e.target) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="os-nt-dialog-head">
        <div>
          <span className="os-nt-eyebrow">{kicker}</span>
          <h2 id="nt-dialog-title">{title}</h2>
        </div>
        <Button aria-label="Close dialog" disabled={busy} onClick={onClose}>
          <X size={17} />
        </Button>
      </div>
      <div className="os-nt-dialog-body">{children}</div>
    </dialog>
  );
}
export function Table<T>({
  label,
  rows,
  cols,
  empty = "Nothing matches this view.",
}: {
  label: string;
  rows: T[];
  cols: ColumnDef<T, unknown>[];
  empty?: string;
}) {
  const t = useReactTable({
    data: rows,
    columns: cols,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div
      className="os-nt-table-wrap"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="table os-nt-table">
        <thead>
          {t.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id} scope="col">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {t.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty>{empty}</Empty>}
    </div>
  );
}
export function WorkspaceLink({ notice }: { notice: Notice }) {
  const { destination, ref } = notice;
  if (destination === "scheduler" && ref?.startsWith("OS-SCH-"))
    return (
      <Link
        className="os-nt-link"
        to="/dashboard/scheduler"
        search={{ recordSource: ref }}
      >
        Open Scheduler <ArrowUpRight size={14} />
      </Link>
    );
  if (destination === "automation" && ref?.startsWith("rul-"))
    return (
      <Link
        className="os-nt-link"
        to="/dashboard/automation"
        search={{ recordSource: ref }}
      >
        Open Automation <ArrowUpRight size={14} />
      </Link>
    );
  if (destination === "copilot" && ref?.startsWith("AI-"))
    return (
      <Link
        className="os-nt-link"
        to="/dashboard/copilot"
        search={{ proposal: ref }}
      >
        Open proposal <ArrowUpRight size={14} />
      </Link>
    );
  if (destination === "notifications") return null;
  const names: Record<typeof destination, string> = {
    accounts: "Broker hub",
    positions: "Positions",
    records: "Records",
    scheduler: "Scheduler",
    automation: "Automation",
    deposits: "Deposits",
    withdrawals: "Withdrawals",
    transfers: "Transfers & ledger",
    copilot: "Co-Pilot",
    risk: "Risk & Guardrails",
    markets: "Markets calendar",
    signals: "Signal Desk",
  };
  return (
    <Link className="os-nt-link" to={`/dashboard/${destination}`}>
      Open {names[destination]} <ArrowUpRight size={14} />
    </Link>
  );
}
