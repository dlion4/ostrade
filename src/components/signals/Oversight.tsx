import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  AudioLines,
  ChartNoAxesCombined,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  Link2,
  ListChecks,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  eatTime,
  muteFeed,
  overrideGuard,
  updateGuards,
  type DeskFeed,
  type GuardEvent,
  type GuardPolicy,
} from "@/services/signalDesk";
import { Dialog, PanelTitle, SourceMark, formatPnl } from "./DeskUI";

export function ImportSection({
  onImport,
}: {
  onImport: (mode: "rows" | "file" | "provider") => void;
}) {
  return (
    <section className="os-desk-panel os-lower-panel">
      <PanelTitle icon={FileUp} title="Import center" />
      <p className="os-panel-desc">
        Bring trades from a provider or statement into your signal inbox.
      </p>
      <div className="os-import-methods">
        {(
          [
            {
              mode: "rows",
              icon: FileSpreadsheet,
              title: "Provider export",
              desc: "Paste rows and map columns.",
            },
            {
              mode: "file",
              icon: FileUp,
              title: "Broker statement",
              desc: "Import MQL5 HTML or CSV.",
            },
            {
              mode: "provider",
              icon: Link2,
              title: "CopyFactory",
              desc: "Preview a strategy connection.",
            },
          ] as const
        ).map((m) => (
          <button type="button" key={m.mode} onClick={() => onImport(m.mode)}>
            <span
              className={`os-source-mark os-tint-${m.mode === "rows" ? "csv" : m.mode === "file" ? "email" : "copyfactory"}`}
            >
              <m.icon size={17} />
            </span>
            <span>
              <b>{m.title}</b>
              <small>{m.desc}</small>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}
export function PerformanceSection({
  feeds,
  refresh,
}: {
  feeds: DeskFeed[];
  refresh: () => void;
}) {
  const [sort, setSort] = useState<"pnl" | "winRate" | "received">("pnl"),
    [all, setAll] = useState(false);
  const toast = useToast();
  const mut = useMutation({
    mutationFn: muteFeed,
    onSuccess: (f) => {
      refresh();
      toast(`${f.name} ${f.muted ? "muted" : "unmuted"}`);
    },
    onError: (e) => toast(e.message),
  });
  const sorted = [...feeds].sort((a, b) => b[sort] - a[sort]);
  return (
    <section className="os-desk-panel os-performance">
      <PanelTitle
        icon={ChartNoAxesCombined}
        title="Source performance"
        action={
          <label className="os-sort-control">
            <ArrowDownWideNarrow size={14} />
            <select
              aria-label="Rank signal sources"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="pnl">Net P&L</option>
              <option value="winRate">Win rate</option>
              <option value="received">Signal volume</option>
            </select>
          </label>
        }
      />
      <p className="os-panel-desc">
        Compare source quality using the paper workspace's recorded outcomes.
      </p>
      <div className="os-inbox-scroll">
        <table className="os-desk-table">
          <thead>
            <tr>
              {[
                "Source feed",
                "Signals",
                "Executed",
                "Win rate",
                "Net P&L",
                "Slippage",
                "Held",
                "",
              ].map((x, i) => (
                <th key={i}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, all ? sorted.length : 4).map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="os-source-cell">
                    <SourceMark source={f.source} small />
                    <b>{f.name}</b>
                  </div>
                </td>
                <td>{f.received}</td>
                <td>{f.executed}</td>
                <td>
                  <span className="os-win">
                    <i style={{ width: `${f.winRate}%` }} />
                  </span>{" "}
                  {f.winRate.toFixed(1)}%
                </td>
                <td className={f.pnl >= 0 ? "os-up" : "os-down"}>
                  {formatPnl(f.pnl)}
                </td>
                <td>{f.slippage.toFixed(2)} pips</td>
                <td>{f.held}</td>
                <td>
                  <button
                    type="button"
                    className="os-soft-button os-tiny-button"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate(f.id)}
                  >
                    {f.muted ? <Volume2 size={12} /> : <VolumeX size={12} />}{" "}
                    {f.muted ? "Unmute" : "Mute"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="os-bottom-link"
        onClick={() => setAll(!all)}
      >
        {all ? "Show top sources" : `View all ${feeds.length} sources`}{" "}
        <ChevronDown size={13} />
      </button>
    </section>
  );
}

export function GuardSection({
  events,
  policy,
  refresh,
}: {
  events: GuardEvent[];
  policy: GuardPolicy;
  refresh: () => void;
}) {
  const [all, setAll] = useState(false),
    [settings, setSettings] = useState(false),
    [form, setForm] = useState(policy),
    [held, setHeld] = useState<GuardEvent | null>(null),
    [reason, setReason] = useState(""),
    [err, setErr] = useState("");
  const toast = useToast();
  const save = useMutation({
    mutationFn: updateGuards,
    onSuccess: () => {
      refresh();
      setSettings(false);
      toast("Guard thresholds saved");
    },
    onError: (e) => setErr(e.message),
  });
  const override = useMutation({
    mutationFn: () => overrideGuard(held!.id, reason),
    onSuccess: () => {
      refresh();
      setHeld(null);
      setReason("");
      toast("Override recorded. Signal staged for a new review.");
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <section className="os-desk-panel os-guards" id="os-guard-activity">
      <PanelTitle
        icon={ShieldCheck}
        title="Guard activity"
        action={
          <button
            type="button"
            className="os-soft-button"
            onClick={() => {
              setForm(policy);
              setErr("");
              setSettings(true);
            }}
          >
            <SlidersHorizontal size={13} /> Guard settings
          </button>
        }
      />
      <p className="os-panel-desc">
        Duplicate, stale, and high-volume signals are held before they reach an
        account.
      </p>
      <div className="os-guard-events">
        {events.slice(0, all ? events.length : 3).map((ev) => (
          <div className="os-guard-event" key={ev.id}>
            <span
              className={`os-guard-symbol ${ev.overrideReason ? "os-muted-guard" : ""}`}
            >
              <Shield size={16} />
            </span>
            <div>
              <b>
                {ev.type} guard <span>{ev.symbol}</span>
              </b>
              <p>{ev.reason}</p>
              {ev.overrideReason && (
                <small>Reviewed: {ev.overrideReason}</small>
              )}
            </div>
            <time>{eatTime(ev.time)}</time>
            {!ev.overrideReason ? (
              <button
                type="button"
                className="os-soft-button os-tiny-button"
                onClick={() => {
                  setHeld(ev);
                  setErr("");
                  setReason("");
                }}
              >
                Review
              </button>
            ) : (
              <ListChecks size={16} className="os-muted-copy" />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="os-bottom-link"
        onClick={() => setAll(!all)}
      >
        {all ? "Show recent decisions" : `View all ${events.length} decisions`}{" "}
        <ChevronDown size={13} />
      </button>
      {settings && (
        <Dialog
          title="Ingestion guardrails"
          overline="LOCAL POLICY"
          onClose={() => setSettings(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="os-dialog-body os-form-stack">
              {(
                [
                  ["duplicateMinutes", "Duplicate window (minutes)", 1, 1440],
                  [
                    "stormRate",
                    "Maximum signals per source per minute",
                    1,
                    100,
                  ],
                  ["stalePercent", "Maximum price deviation (%)", 0.01, 25],
                ] as const
              ).map(([k, n, min, max]) => (
                <label className="os-field" key={k}>
                  {n}
                  <input
                    type="number"
                    required
                    min={min}
                    max={max}
                    step={k === "stalePercent" ? 0.01 : 1}
                    value={form[k] || ""}
                    onChange={(e) => setForm({ ...form, [k]: +e.target.value })}
                  />
                </label>
              ))}
              {err && <p className="os-form-error">{err}</p>}
            </div>
            <footer className="os-dialog-foot">
              <span>
                <AudioLines size={13} /> Applies to new signals
              </span>
              <button className="os-action-primary" disabled={save.isPending}>
                Save settings
              </button>
            </footer>
          </form>
        </Dialog>
      )}
      {held && (
        <Dialog
          title="Review quarantined signal"
          overline={held.signalId}
          onClose={() => setHeld(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              override.mutate();
            }}
          >
            <div className="os-dialog-body">
              <div className="os-info-line os-warn-line">
                <Shield size={16} />
                {held.reason}
              </div>
              <label className="os-field">
                Override reason
                <textarea
                  required
                  minLength={8}
                  maxLength={400}
                  value={reason}
                  rows={3}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this signal may be reviewed again."
                />
              </label>
              <p className="os-muted-copy">
                The reason is written to Records. Approval returns the signal to
                staging; it does not place an order or bypass risk checks.
              </p>
              {err && <p className="os-form-error">{err}</p>}
            </div>
            <footer className="os-dialog-foot">
              <button
                type="button"
                className="os-soft-button"
                onClick={() => setHeld(null)}
              >
                Keep quarantined
              </button>
              <button
                className="os-action-primary"
                disabled={override.isPending}
              >
                Override & stage
              </button>
            </footer>
          </form>
        </Dialog>
      )}
    </section>
  );
}
