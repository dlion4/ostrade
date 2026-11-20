import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, X } from "lucide-react";
export const settingsKey = ["settings"] as const;
export function useSave<T, R>(
  fn: (input: T) => Promise<R>,
  done?: (result: R) => void,
  section?: string,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (section)
        void cache.invalidateQueries({ queryKey: [...settingsKey, section] });
      done?.(r);
    },
  });
}
export function Button({
  kind = "soft",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "soft" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      {...p}
      className={`btn os-st-button os-st-${kind} ${className}`}
    />
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  return <span className={`os-st-badge os-st-${tone}`}>{children}</span>;
}
export function Panel({
  label,
  title,
  copy,
  action,
  children,
}: {
  label: string;
  title: string;
  copy?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="os-st-card">
      <header className="os-st-card-head">
        <div>
          <span className="os-st-kicker">{label}</span>
          <h3>{title}</h3>
          {copy && <p>{copy}</p>}
        </div>
        {action}
      </header>
      {children}
    </article>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="os-st-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (T | readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      className="form-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((option) =>
        typeof option === "string" ? (
          <option key={option}>{option}</option>
        ) : (
          <option key={option[0]} value={option[0]}>
            {option[1]}
          </option>
        ),
      )}
    </select>
  );
}
export function Toggle({
  children,
  checked,
  onChange,
  disabled,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="os-st-toggle">
      <input
        role="switch"
        type="checkbox"
        className="form-check-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{children}</span>
    </label>
  );
}
export function Feedback({
  error,
  note,
  pending,
}: {
  error?: Error | null;
  note?: string;
  pending?: boolean;
}) {
  return error ? (
    <p role="alert" className="os-st-error">
      <CircleAlert size={15} />
      {error.message}
    </p>
  ) : pending ? (
    <p role="status" className="os-st-feedback">
      <LoaderCircle className="os-st-spin" size={15} />
      Working locally…
    </p>
  ) : note ? (
    <p role="status" className="os-st-feedback">
      {note}
    </p>
  ) : null;
}
export function Table({
  headers,
  children,
  label,
}: {
  headers: string[];
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className="os-st-table-wrap"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="table os-st-table" aria-label={label}>
        <thead>
          <tr>
            {headers.map((x) => (
              <th key={x} scope="col">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const old = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      className="os-st-modal"
      aria-labelledby="st-dialog-title"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h3 id="st-dialog-title">{title}</h3>
        <Button onClick={close} aria-label="Close dialog">
          <X size={17} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export function Gate({
  title,
  copy,
  close,
  action,
  length = 6,
  children,
}: {
  title: string;
  copy: string;
  close: () => void;
  action: (code: string) => Promise<unknown>;
  length?: number;
  children?: ReactNode;
}) {
  const [code, setCode] = useState("");
  const m = useMutation({ mutationFn: action });
  return (
    <Modal title={title} close={close}>
      <p>{copy}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(code);
        }}
      >
        {children}
        <Field label={length === 6 ? "Demo verification code" : "Confirmation"}>
          <input
            required
            inputMode="numeric"
            className="form-control"
            value={code}
            maxLength={length}
            pattern={`[0-9]{${length}}`}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Feedback error={m.error} pending={m.isPending} />
        <div className="os-st-actions">
          <Button type="submit" kind="primary" disabled={m.isPending}>
            Confirm local action
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Secret({
  value,
  label = "Copy demo value",
}: {
  value: string;
  label?: string;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="os-st-secret">
      <code>{value}</code>
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setNote("Copied.");
          } catch {
            setNote(
              "Clipboard unavailable. Select and copy the value manually.",
            );
          }
        }}
      >
        {label}
      </Button>
      {note && <span role="status">{note}</span>}
    </div>
  );
}
export const stamp = (v: string) =>
  new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(v)) + " EAT";
