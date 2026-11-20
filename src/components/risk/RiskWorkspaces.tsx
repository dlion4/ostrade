import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpRight,
  Check,
  Clock3,
  FlaskConical,
  Radar,
  X,
} from "lucide-react";
import {
  carryOptions,
  channelOptions,
  getRiskAudit,
  getRiskCatalog,
  getRiskConfig,
  getRiskSessions,
  riskCases,
  runRiskLab,
  saveRiskSession,
  saveRiskShields,
  shieldFields,
  stopRiskSession,
  type RiskAudit,
  type RiskShields,
  type RiskTicket,
  type SessionPolicy,
} from "@/services/risk";
import {
  Btn,
  Busy,
  Code,
  Dialog,
  eat,
  ErrorText,
  Note,
  RiskTable,
  Tag,
  usd,
  useRiskRefresh,
} from "./RiskUI";

const baseline: RiskTicket = {
  ...riskCases[0],
  accountId: "acc-paper-main",
  side: "BUY",
  channel: "Manual",
  carry: "Intraday",
};
export function Lab() {
  const q = useQuery({
    queryKey: ["risk", "catalog"],
    queryFn: getRiskCatalog,
  });
  const [ticket, setTicket] = useState<RiskTicket>(baseline),
    [preset, setPreset] = useState<string>("clean"),
    [reason, setReason] = useState("");
  const refresh = useRiskRefresh();
  const mut = useMutation({
    mutationFn: (override: boolean) =>
      runRiskLab({ ticket, overrideReason: override ? reason : undefined }),
    onSuccess: refresh,
  });
  const update = <K extends keyof RiskTicket>(k: K, v: RiskTicket[K]) => {
    setTicket((current) => ({ ...current, [k]: v }));
    setReason("");
    mut.reset();
  };
  const soft =
    mut.data?.checks.some((c) => c.decision === "BLOCK" && c.overridable) &&
    !mut.data?.checks.some((c) => c.decision === "BLOCK" && !c.overridable);
  return (
    <div className="os-rk-grid os-rk-lab-grid">
      <form
        className="os-rk-card os-rk-panel"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate(false);
        }}
      >
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">REPORT ONLY</span>
            <h3>Replay a ticket</h3>
          </div>
          <span className="os-rk-icon os-rk-blue">
            <FlaskConical size={18} />
          </span>
        </div>
        <label className="os-rk-field">
          <span>Example scenario</span>
          <select
            className="form-select"
            value={preset}
            disabled={mut.isPending}
            onChange={(e) => {
              setPreset(e.target.value);
              const example = riskCases.find((x) => x.id === e.target.value);
              if (example)
                setTicket({
                  ...baseline,
                  ...example,
                  accountId: ticket.accountId,
                  channel: ticket.channel,
                  carry: ticket.carry,
                });
              setReason("");
              mut.reset();
            }}
          >
            {riskCases.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="os-rk-form-grid">
          <label className="os-rk-field">
            <span>Account profile</span>
            <select
              className="form-select"
              value={ticket.accountId}
              onChange={(e) => update("accountId", e.target.value)}
            >
              {q.data?.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="os-rk-field">
            <span>Order source</span>
            <select
              className="form-select"
              value={ticket.channel}
              onChange={(e) =>
                update("channel", e.target.value as RiskTicket["channel"])
              }
            >
              {channelOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="os-rk-field">
            <span>Symbol</span>
            <input
              list="risk-symbol-list"
              required
              maxLength={24}
              className="form-control"
              value={ticket.symbol}
              onChange={(e) => update("symbol", e.target.value)}
            />
            <datalist id="risk-symbol-list">
              {q.data?.markets.map((m) => (
                <option key={m.symbol}>{m.symbol}</option>
              ))}
            </datalist>
          </label>
          <label className="os-rk-field">
            <span>Side</span>
            <select
              className="form-select"
              value={ticket.side}
              onChange={(e) =>
                update("side", e.target.value as RiskTicket["side"])
              }
            >
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </label>
          {(["size", "entry", "sl", "tp"] as const).map((k, i) => (
            <label className="os-rk-field" key={k}>
              <span>
                {["Size / stake", "Entry price", "Stop loss", "Take profit"][i]}
              </span>
              <input
                type="number"
                min={0}
                step="any"
                required
                className="form-control"
                value={Number.isNaN(ticket[k]) ? "" : ticket[k]}
                onChange={(e) => update(k, e.target.valueAsNumber)}
              />
            </label>
          ))}
        </div>
        <label className="os-rk-field">
          <span>Intended hold</span>
          <select
            className="form-select"
            value={ticket.carry}
            onChange={(e) =>
              update("carry", e.target.value as RiskTicket["carry"])
            }
          >
            {carryOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="os-rk-actions">
          <Btn
            type="submit"
            kind="primary"
            disabled={q.isPending || q.isError || mut.isPending}
          >
            {mut.isPending ? "Evaluating…" : "Run pre-trade checks"}
          </Btn>
          <Link className="os-rk-link" to="/dashboard/trade">
            Trade Ticket <ArrowUpRight size={14} />
          </Link>
        </div>
        <ErrorText error={q.error ?? mut.error} />
      </form>
      <div className="os-rk-card os-rk-panel">
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">CHECK PIPELINE</span>
            <h3>Evaluation result</h3>
          </div>
          {mut.data && (
            <Tag
              tone={
                mut.data.decision === "PASS"
                  ? "green"
                  : mut.data.decision === "BLOCK"
                    ? "red"
                    : "amber"
              }
            >
              {mut.data.decision}
            </Tag>
          )}
        </div>
        {mut.data ? (
          <>
            <div className="os-rk-subline">
              <span>
                {mut.data.scope} ·{" "}
                {mut.data.risk === null
                  ? "Risk unavailable"
                  : `${usd(mut.data.risk)} at risk`}
              </span>
              <code>{mut.data.ref}</code>
            </div>
            <ol className="os-rk-checks">
              {mut.data.checks.map((c) => (
                <li
                  className={c.decision === "BLOCK" ? "os-rk-check-block" : ""}
                  key={c.id}
                >
                  <span
                    className={`os-rk-icon ${c.decision === "PASS" ? "os-rk-green" : c.decision === "BLOCK" ? "os-rk-red" : "os-rk-amber"}`}
                  >
                    {c.decision === "BLOCK" ? (
                      <X size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {c.label}
                      {c.decision === "OVERRIDE" ? " · override recorded" : ""}
                    </strong>
                    <small>{c.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
            {soft && (
              <form
                className="os-rk-flow"
                onSubmit={(e) => {
                  e.preventDefault();
                  mut.mutate(true);
                }}
              >
                <label className="os-rk-field">
                  <span>Lab override reason</span>
                  <input
                    className="form-control"
                    required
                    minLength={12}
                    maxLength={240}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this soft warning acceptable?"
                  />
                </label>
                <Btn type="submit" disabled={mut.isPending}>
                  Record lab override
                </Btn>
                <small className="os-rk-muted">
                  Does not clear or authorize a real order.
                </small>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="os-rk-empty os-rk-lab-empty">
              <FlaskConical size={26} />
              <strong>No ticket evaluated yet</strong>
              <span>
                Choose a scenario to see what passes, blocks, or needs review.
              </span>
            </div>
            <div className="os-rk-stages">
              {[
                "Tradable instrument",
                "Capability & bounds",
                "Margin & guardrails",
                "Duplicate & storm",
                "Stake & price sanity",
                "Session & carry",
              ].map((x, i) => (
                <span key={x}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  {x}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function Shields() {
  const q = useQuery({ queryKey: ["risk", "config"], queryFn: getRiskConfig });
  const audit = useQuery({
    queryKey: ["risk", "audit"],
    queryFn: getRiskAudit,
  });
  const [edit, setEdit] = useState(false),
    [notice, setNotice] = useState("");
  const rows =
    audit.data
      ?.filter((a) => a.category === "Shield" && a.decision !== "PASS")
      .slice(0, 8) ?? [];
  const cols: ColumnDef<RiskAudit, unknown>[] = [
    {
      id: "trigger",
      header: "Trigger",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.rule}</strong>
          <small>
            {eat(r.at)} EAT · {r.mode}
          </small>
        </>
      ),
    },
    { id: "order", header: "Order / signal", accessorKey: "subject" },
    {
      id: "action",
      header: "Action",
      cell: ({ row: { original: r } }) => (
        <Tag tone={r.decision === "OVERRIDE" ? "amber" : "red"}>
          {r.decision === "OVERRIDE"
            ? "Confirmed anyway"
            : r.rule.includes("storm") || r.rule.includes("Storm")
              ? "Quarantined"
              : "Blocked"}
        </Tag>
      ),
    },
    {
      id: "reason",
      header: "Evidence / reason",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.detail}</strong>
          {r.reason && <small>{r.reason}</small>}
        </>
      ),
    },
  ];
  return (
    <div className="os-rk-card">
      <div className="os-rk-toolbar">
        <div>
          <strong>Submission shields</strong>
          <small>
            Hard rate and duplicate gates; only stake outliers and price sanity
            permit manual review.
          </small>
        </div>
        <Btn onClick={() => setEdit(true)} disabled={!q.data}>
          <Radar size={15} /> Configure shields
        </Btn>
      </div>
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <ErrorText error={q.error} />
      ) : (
        q.data && (
          <div className="os-rk-shield-grid">
            {shieldFields.map((f) => (
              <div key={f.key}>
                <span>{f.label}</span>
                <strong>
                  {q.data.shields[f.key]} <small>{f.unit}</small>
                </strong>
                <p>{f.detail}</p>
              </div>
            ))}
          </div>
        )
      )}
      {notice && (
        <div className="os-rk-inline">
          <Note>{notice}</Note>
        </div>
      )}
      {audit.isPending ? (
        <Busy />
      ) : audit.isError ? (
        <ErrorText error={audit.error} />
      ) : (
        <RiskTable rows={rows} cols={cols} label="Shield trigger events" />
      )}
      <div className="os-rk-inline">
        <Link className="os-rk-link" to="/dashboard/signals">
          Open Signal Desk quarantine <ArrowUpRight size={14} />
        </Link>
      </div>
      {edit && q.data && (
        <ShieldEditor
          settings={q.data.shields}
          close={() => setEdit(false)}
          onDone={(text) => {
            setEdit(false);
            setNotice(text);
          }}
        />
      )}
    </div>
  );
}
function ShieldEditor({
  settings,
  close,
  onDone,
}: {
  settings: RiskShields;
  close: () => void;
  onDone: (s: string) => void;
}) {
  const [values, setValues] = useState(settings),
    [code, setCode] = useState("");
  const refresh = useRiskRefresh();
  const mut = useMutation({
    mutationFn: () => saveRiskShields({ settings: values, code }),
    onSuccess: (r) => {
      refresh();
      onDone(r.message);
    },
  });
  return (
    <Dialog
      title="Configure submission shields"
      eyebrow="PROTECTED CHANGE"
      close={close}
      busy={mut.isPending}
    >
      <form
        className="os-rk-flow"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="os-rk-form-grid">
          {shieldFields.map((f) => (
            <label className="os-rk-field" key={f.key}>
              <span>
                {f.label} ({f.unit})
              </span>
              <input
                className="form-control"
                type="number"
                required
                min={f.min}
                max={f.max}
                step={
                  ["medianFactor", "priceDeviationPct"].includes(f.key)
                    ? "any"
                    : 1
                }
                value={Number.isNaN(values[f.key]) ? "" : values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.valueAsNumber })
                }
              />
              <small>{f.detail}</small>
            </label>
          ))}
        </div>
        <Code value={code} set={setCode} />
        <ErrorText error={mut.error} />
        <div className="os-rk-actions">
          <Btn onClick={close} disabled={mut.isPending}>
            Cancel
          </Btn>
          <Btn type="submit" kind="primary" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save shields"}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}

type Session = Awaited<ReturnType<typeof getRiskSessions>>["rows"][number];
export function Sessions() {
  const q = useQuery({
    queryKey: ["risk", "sessions"],
    queryFn: getRiskSessions,
  });
  const [picked, setPicked] = useState("acc-paper-main"),
    [mode, setMode] = useState<"edit" | "stop">(),
    [notice, setNotice] = useState("");
  const row = q.data?.rows.find((r) => r.accountId === picked);
  const total =
    row === undefined ? 0 : Math.min(100, (row.minutes / row.cap) * 100);
  return (
    <div className="os-rk-grid os-rk-session-grid">
      <div className="os-rk-card os-rk-panel">
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">EAST AFRICA TIME · UTC+3</span>
            <h3>Daily session clock</h3>
          </div>
          <span className="os-rk-icon os-rk-blue">
            <Clock3 size={18} />
          </span>
        </div>
        {q.isPending ? (
          <Busy />
        ) : q.isError ? (
          <ErrorText error={q.error} />
        ) : (
          <>
            <label className="os-rk-field">
              <span>Session account</span>
              <select
                className="form-select"
                value={picked}
                onChange={(e) => {
                  setPicked(e.target.value);
                  setNotice("");
                }}
              >
                {q.data?.rows.map((r) => (
                  <option key={r.accountId} value={r.accountId}>
                    {r.accountLabel}
                  </option>
                ))}
              </select>
            </label>
            {row && (
              <>
                <div className="os-rk-session-meter">
                  <strong>
                    {row.minutes} <small>/ {row.cap} min</small>
                  </strong>
                  <Tag
                    tone={
                      row.stopped ? "red" : row.reminderDue ? "amber" : "green"
                    }
                  >
                    {row.stopped
                      ? "Session stopped"
                      : row.reminderDue
                        ? "Break suggested"
                        : "Within limit"}
                  </Tag>
                </div>
                <div
                  className="os-rk-track"
                  role="progressbar"
                  aria-label="Daily session use"
                  aria-valuenow={Math.round(total)}
                >
                  <span style={{ width: `${total}%` }} />
                </div>
                <small className="os-rk-muted">
                  Sample opening minutes plus active local Paper fill minutes.
                  Resets by EAT day for local activity.
                </small>
                <div className="os-rk-actions">
                  <Btn onClick={() => setMode("edit")}>Session settings</Btn>
                  <Btn
                    kind="danger"
                    disabled={q.data?.workspaceStopped}
                    onClick={() => setMode("stop")}
                  >
                    Stop trading for today
                  </Btn>
                </div>
              </>
            )}
          </>
        )}
        {notice && <Note>{notice}</Note>}
      </div>
      <aside className="os-rk-card os-rk-panel">
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">OPERATOR WELLBEING</span>
            <h3>Reality check</h3>
          </div>
          <Tag tone="blue">Local enforcement</Tag>
        </div>
        <div className="os-rk-facts">
          <div>
            <span>Break reminder interval</span>
            <strong>{row ? `${row.settings.reminder} min` : "—"}</strong>
          </div>
          <div>
            <span>Consecutive losses today</span>
            <strong>
              {row ? `${row.streak} / ${row.settings.lossStreak}` : "—"}
            </strong>
          </div>
          <div>
            <span>Deriv mapping</span>
            <code>reality_check</code>
          </div>
          <div>
            <span>MT5 & other profiles</span>
            <strong>Platform-side only</strong>
          </div>
        </div>
        <small className="os-rk-muted">
          No timer, external reminder, or settings update is sent to a broker.
          Hard session limits are checked on submission.
        </small>
        {row?.reminderDue && (
          <Note>Consider a short break before reviewing another ticket.</Note>
        )}
      </aside>
      {mode && row && (
        <SessionDialog
          row={row}
          mode={mode}
          close={() => setMode(undefined)}
          onDone={(text) => {
            setNotice(text);
            setMode(undefined);
          }}
        />
      )}
    </div>
  );
}
function SessionDialog({
  row,
  mode,
  close,
  onDone,
}: {
  row: Session;
  mode: "edit" | "stop";
  close: () => void;
  onDone: (text: string) => void;
}) {
  const [settings, setSettings] = useState<SessionPolicy>(row.settings),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [scope, setScope] = useState(row.accountId);
  const refresh = useRiskRefresh();
  const mut = useMutation({
    mutationFn: () =>
      mode === "edit"
        ? saveRiskSession({ accountId: row.accountId, settings, code })
        : stopRiskSession({ scope, reason, code }),
    onSuccess: (r) => {
      refresh();
      onDone(r.message);
    },
  });
  return (
    <Dialog
      title={mode === "edit" ? "Session settings" : "Stop trading for today"}
      eyebrow={row.accountLabel.toUpperCase()}
      close={close}
      busy={mut.isPending}
    >
      <form
        className="os-rk-flow"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        {mode === "edit" ? (
          <div className="os-rk-form-grid">
            <label className="os-rk-field">
              <span>Remind every (minutes)</span>
              <input
                type="number"
                className="form-control"
                required
                min={15}
                max={240}
                value={settings.reminder}
                onChange={(e) =>
                  setSettings({ ...settings, reminder: +e.target.value })
                }
              />
            </label>
            <label className="os-rk-field">
              <span>Stop after consecutive losses</span>
              <input
                type="number"
                className="form-control"
                required
                min={1}
                max={20}
                value={settings.lossStreak}
                onChange={(e) =>
                  setSettings({ ...settings, lossStreak: +e.target.value })
                }
              />
            </label>
          </div>
        ) : (
          <>
            <Note>
              Blocks new entries until the next EAT day. You can still close
              positions.
            </Note>
            <label className="os-rk-field">
              <span>Soft-lock scope</span>
              <select
                className="form-select"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value={row.accountId}>{row.accountLabel}</option>
                <option value="all">All accounts</option>
              </select>
            </label>
            <label className="os-rk-field">
              <span>Operator reason</span>
              <input
                className="form-control"
                required
                minLength={12}
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </>
        )}
        <Code value={code} set={setCode} />
        <ErrorText error={mut.error} />
        <div className="os-rk-actions">
          <Btn onClick={close} disabled={mut.isPending}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            kind={mode === "stop" ? "danger" : "primary"}
            disabled={mut.isPending}
          >
            {mut.isPending
              ? "Applying…"
              : mode === "stop"
                ? "Confirm EAT soft lock"
                : "Save session settings"}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
