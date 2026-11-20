import {
  useEffect,
  useMemo,
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
import { CircleAlert, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const usd = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
export const eat = (at: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
  children: ReactNode;
}) {
  return <span className={`os-rk-tag os-rk-${tone}`}>{children}</span>;
}
export function Btn({
  children,
  kind = "",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "danger" | "";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`btn os-rk-btn ${kind ? `os-rk-btn-${kind}` : ""} ${className}`}
    >
      {children}
    </button>
  );
}
export function Note({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`os-rk-note${error ? " os-rk-note-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? <CircleAlert size={16} /> : <ShieldCheck size={16} />}
      <span>{children}</span>
    </div>
  );
}
export function Busy({
  children = "Loading local snapshot…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="os-rk-empty" role="status">
      <LoaderCircle className="os-rk-spinner" size={18} />
      {children}
    </div>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <Note error>
      {error instanceof Error
        ? error.message
        : "The local service could not complete the request."}
    </Note>
  ) : null;
}
export function Code({
  value,
  set,
}: {
  value: string;
  set: (n: string) => void;
}) {
  return (
    <label className="os-rk-field">
      <span>Demo authenticator code</span>
      <input
        className="form-control"
        value={value}
        onChange={(e) => set(e.target.value)}
        required
        pattern="[0-9]{6}"
        maxLength={6}
        inputMode="numeric"
        autoComplete="off"
        placeholder="123456"
      />
      <small>Use 123456. Never enter a real security code.</small>
    </label>
  );
}
export function Dialog({
  title,
  eyebrow,
  close,
  busy,
  children,
}: {
  title: string;
  eyebrow: string;
  close: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const node = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = node.current;
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
      ref={node}
      className="os-rk-dialog"
      aria-labelledby="risk-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            close();
        }
      }}
    >
      <div className="os-rk-dialog-head">
        <div>
          <span className="os-rk-eyebrow">{eyebrow}</span>
          <h2 id="risk-dialog-title">{title}</h2>
        </div>
        <Btn aria-label="Close dialog" disabled={busy} onClick={close}>
          <X size={17} />
        </Btn>
      </div>
      <div className="os-rk-dialog-body">{children}</div>
    </dialog>
  );
}
export function RiskTable<T>({
  rows,
  cols,
  label,
  empty = "Nothing to show for this selection.",
}: {
  rows: T[];
  cols: ColumnDef<T, unknown>[];
  label: string;
  empty?: string;
}) {
  const core = useMemo(() => getCoreRowModel<T>(), []);
  const table = useReactTable({
    data: rows,
    columns: cols,
    getCoreRowModel: core,
  });
  return (
    <div
      className="os-rk-table-wrap"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="table os-rk-table">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th scope="col" key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
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
      {!rows.length && <p className="os-rk-empty">{empty}</p>}
    </div>
  );
}
export function useRiskRefresh() {
  const client = useQueryClient();
  return () => void client.invalidateQueries();
}
