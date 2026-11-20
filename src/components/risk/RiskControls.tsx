import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CirclePause,
  FileCheck2,
  LockKeyhole,
  Power,
  Shield,
  SlidersHorizontal,
  XOctagon,
} from "lucide-react";
import {
  getRiskConfig,
  getRiskOverview,
  getRiskReceipts,
  holdModes,
  retryRiskReceipt,
  riskPolicies,
  runRiskControl,
  saveRiskRule,
  type RiskControlKind,
  type RiskReceipt,
  type RiskRule,
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
  useRiskRefresh,
} from "./RiskUI";

type Overview = Awaited<ReturnType<typeof getRiskOverview>>;
const controls = [
  {
    key: "pause",
    icon: CirclePause,
    title: "Pause automation",
    detail:
      "Stop rules and schedules. Manual tickets still run through pre-trade checks.",
    tone: "amber",
  },
  {
    key: "flatten",
    icon: XOctagon,
    title: "Close all positions",
    detail:
      "Close Paper positions, halt automation, and list broker positions as untouched.",
    tone: "red",
  },
  {
    key: "lockdown",
    icon: LockKeyhole,
    title: "Full lockdown",
    detail: "Block all new entries. Token revocation is an offline preview.",
    tone: "red",
  },
] as const;
export function Emergency({
  view,
  onReport,
}: {
  view?: Overview;
  onReport: () => void;
}) {
  const [target, setTarget] = useState(""),
    [dialog, setDialog] = useState<{
      kind: RiskControlKind;
      title: string;
      detail: string;
      target?: string;
    }>(),
    [notice, setNotice] = useState("");
  const armed = view?.state === "armed";
  const scopeTarget = target ? target.split("|")[0] : "",
    targetId = target ? target.split("|")[1] : "";
  const paused =
    scopeTarget === "account"
      ? view?.pausedAccounts.includes(targetId)
      : view?.pausedRules.includes(targetId);
  const allow = !!view && !view.controlBusy;
  return (
    <div className="os-rk-grid os-rk-emergency-grid">
      <div className="os-rk-card os-rk-panel">
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">WORKSPACE CONTROL</span>
            <h3>Emergency actions</h3>
          </div>
          <Tag tone={armed ? "green" : "red"}>
            <i className={armed ? "os-rk-pulse" : ""} />
            {view?.state.toUpperCase() ?? "READING STATE"}
          </Tag>
        </div>
        <div className="os-rk-control-cards">
          {controls.map(({ key, icon: Icon, title, detail, tone }) => (
            <article key={key} className="os-rk-control">
              <span className={`os-rk-icon os-rk-${tone}`}>
                <Icon size={18} />
              </span>
              <h4>{title}</h4>
              <p>{detail}</p>
              <Btn
                kind={key === "pause" ? "" : "danger"}
                disabled={
                  !allow ||
                  (key === "pause" && !armed) ||
                  (key === "lockdown" && view?.state === "lockdown")
                }
                onClick={() => setDialog({ kind: key, title, detail })}
              >
                Review action <ArrowDownRight size={14} />
              </Btn>
            </article>
          ))}
        </div>
        <div className="os-rk-emergency-foot">
          <span>
            <strong>Last engagement</strong>
            <small>
              {view?.engagement
                ? `${eat(view.engagement.at)} EAT · ${view.engagement.reason}`
                : "No emergency control engaged this session."}
            </small>
          </span>
          {!armed && view && (
            <Btn
              onClick={() =>
                setDialog({
                  kind: "rearm",
                  title: "Re-arm workspace",
                  detail:
                    "Restore only the automation settings that were active before the workspace halt. Scoped pauses and disabled drafts remain in place.",
                })
              }
            >
              <Power size={15} /> Re-arm with 2FA
            </Btn>
          )}
        </div>
        {notice && (
          <Note>
            {notice}{" "}
            <button className="os-rk-link" onClick={onReport}>
              View receipts <ArrowUpRight size={13} />
            </button>
          </Note>
        )}
      </div>
      <aside className="os-rk-card os-rk-panel">
        <div className="os-rk-panel-head">
          <div>
            <span className="os-rk-eyebrow">LIMIT THE BLAST RADIUS</span>
            <h3>Scoped pause</h3>
          </div>
          <span className="os-rk-icon os-rk-blue">
            <Shield size={18} />
          </span>
        </div>
        <p>
          Hold a single broker profile or automation rule without changing the
          workspace state.
        </p>
        <label className="os-rk-field">
          <span>Account or rule</span>
          <select
            className="form-select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose a scope</option>
            <optgroup label="Accounts">
              {view?.accounts.map((a) => (
                <option value={`account|${a.id}`} key={a.id}>
                  {a.label}
                  {view.pausedAccounts.includes(a.id) ? " · paused" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Automation rules">
              {view?.rules.map((r) => (
                <option value={`rule|${r.id}`} key={r.id}>
                  {r.name}
                  {view.pausedRules.includes(r.id) ? " · paused" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <Btn
          disabled={!allow || !target}
          onClick={() =>
            setDialog({
              kind: `${scopeTarget === "account" ? "account" : "rule"}-${paused ? "resume" : "pause"}`,
              title: paused ? "Remove scoped pause" : "Pause this scope",
              detail: paused
                ? "Remove the specific hold only. The global state still applies."
                : "This prevents automated entries for the selected scope. Open positions are not closed.",
              target: targetId,
            })
          }
        >
          {paused ? "Review scoped resume" : "Review scoped pause"}
        </Btn>
        <div className="os-rk-muted os-rk-micro">
          <span>{view?.pausedAccounts.length ?? 0} account holds</span>
          <span>{view?.pausedRules.length ?? 0} rule holds</span>
        </div>
        <small className="os-rk-muted">
          Control events appear in the local audit. Telegram and push broadcasts
          are previews only.
        </small>
      </aside>
      {dialog && (
        <ProtectedControl
          title={dialog.title}
          detail={dialog.detail}
          action={dialog.kind}
          id={dialog.target}
          close={() => setDialog(undefined)}
          onDone={(text) => {
            setNotice(text);
            setDialog(undefined);
          }}
        />
      )}
    </div>
  );
}
function ProtectedControl({
  title,
  detail,
  action,
  id,
  close,
  onDone,
}: {
  title: string;
  detail: string;
  action: RiskControlKind | "retry";
  id?: string;
  close: () => void;
  onDone: (text: string) => void;
}) {
  const [reason, setReason] = useState(""),
    [code, setCode] = useState("");
  const refresh = useRiskRefresh();
  const mut = useMutation({
    mutationFn: () =>
      action === "retry"
        ? retryRiskReceipt({ id: id!, reason, code })
        : runRiskControl({ kind: action, target: id, reason, code }),
    onSuccess: (r) => {
      refresh();
      onDone(r.message);
    },
  });
  return (
    <Dialog
      title={title}
      eyebrow="PROTECTED CONTROL · DEMO 2FA"
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
        <Note>{detail}</Note>
        <label className="os-rk-field">
          <span>Operator reason</span>
          <textarea
            className="form-control"
            required
            minLength={12}
            maxLength={240}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this action is needed"
          />
        </label>
        <Code value={code} set={setCode} />
        <ErrorText error={mut.error} />
        <div className="os-rk-actions">
          <Btn onClick={close} disabled={mut.isPending}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            kind={
              ["flatten", "lockdown"].includes(action) ? "danger" : "primary"
            }
            disabled={mut.isPending}
          >
            {mut.isPending ? "Applying locally…" : "Confirm local action"}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
export function PolicyRules({ view }: { view?: Overview }) {
  const q = useQuery({ queryKey: ["risk", "config"], queryFn: getRiskConfig });
  const [filter, setFilter] = useState("all"),
    [dialog, setDialog] = useState<RiskRule>(),
    [notice, setNotice] = useState("");
  const rows =
    q.data?.policies.filter((r) => r.scope === "all" || r.scope === filter) ??
    [];
  const cols: ColumnDef<RiskRule, unknown>[] = [
    {
      id: "rule",
      header: "Rule",
      cell: ({ row: { original: r } }) => {
        const spec = riskPolicies.find((p) => p.id === r.id);
        return (
          <>
            <strong>{spec?.name}</strong>
            <small>{spec?.detail}</small>
          </>
        );
      },
    },
    {
      id: "threshold",
      header: "Threshold",
      cell: ({ row: { original: r } }) => (
        <span className="os-rk-mono">
          {r.id === "hold"
            ? holdModes[r.value]
            : `${r.value} ${r.id === "openCount" && r.unit === "positions" ? "positions / profile" : r.unit}`}
        </span>
      ),
    },
    {
      id: "scope",
      header: "Applies to",
      cell: ({ row: { original: r } }) =>
        r.scope === "all"
          ? "Workspace"
          : (view?.accounts.find((a) => a.id === r.scope)?.label ?? r.scope),
    },
    {
      id: "status",
      header: "State",
      cell: ({ row: { original: r } }) => (
        <Tag tone={r.enabled ? "green" : "neutral"}>
          {r.enabled ? "Enforced" : "Disabled"}
        </Tag>
      ),
    },
    {
      id: "edit",
      header: "Edit",
      cell: ({ row: { original: r } }) => (
        <Btn
          aria-label={`Edit ${riskPolicies.find((p) => p.id === r.id)?.name} (${r.scope === "all" ? "workspace" : "account"})`}
          onClick={() => setDialog(r)}
        >
          <SlidersHorizontal size={14} />
          <span>Edit</span>
        </Btn>
      ),
    },
  ];
  return (
    <div className="os-rk-card">
      <div className="os-rk-toolbar">
        <div>
          <strong>Policy matrix</strong>
          <small>
            Account limits add to, rather than replace, workspace limits.
          </small>
        </div>
        <label className="os-rk-field">
          <span>Scope filter</span>
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Workspace rules</option>
            {view?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <div className="os-rk-inline">
          <Note>{notice}</Note>
        </div>
      )}
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <div className="os-rk-inline">
          <ErrorText error={q.error} />
          <Btn onClick={() => void q.refetch()}>Retry</Btn>
        </div>
      ) : (
        <RiskTable rows={rows} cols={cols} label="Guardrail policy rules" />
      )}
      {dialog && (
        <RuleEditor
          initial={dialog}
          view={view}
          rows={q.data?.policies ?? []}
          close={() => setDialog(undefined)}
          onDone={(text) => {
            setNotice(text);
            setDialog(undefined);
          }}
        />
      )}
    </div>
  );
}
function RuleEditor({
  initial,
  view,
  rows,
  close,
  onDone,
}: {
  initial: RiskRule;
  view?: Overview;
  rows: RiskRule[];
  close: () => void;
  onDone: (text: string) => void;
}) {
  const [rule, setRule] = useState(initial),
    [code, setCode] = useState("");
  const refresh = useRiskRefresh();
  const spec = riskPolicies.find((p) => p.id === initial.id)!;
  const lock = rule.id === "dailyLoss" && rule.scope === "all";
  const mut = useMutation({
    mutationFn: () => saveRiskRule({ rule, code }),
    onSuccess: (r) => {
      refresh();
      onDone(r.message);
    },
  });
  return (
    <Dialog
      title={spec.name}
      eyebrow="POLICY CHANGE"
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
        <p>{spec.detail}</p>
        <label className="os-rk-field">
          <span>Policy scope</span>
          <select
            className="form-select"
            disabled={rule.id === "hourly"}
            value={rule.scope}
            onChange={(e) => {
              const scope = e.target.value;
              setRule(
                rows.find((r) => r.id === rule.id && r.scope === scope) ?? {
                  ...initial,
                  scope,
                  ...(initial.id === "openCount" && scope !== "all"
                    ? { unit: "positions" }
                    : {}),
                },
              );
            }}
          >
            <option value="all">Workspace</option>
            {view?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            disabled={lock}
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
          />
          <span className="form-check-label">
            Enforce rule{lock ? " · required" : ""}
          </span>
        </label>
        {rule.id === "hold" ? (
          <label className="os-rk-field">
            <span>Carry policy</span>
            <select
              className="form-select"
              value={rule.value}
              onChange={(e) => setRule({ ...rule, value: +e.target.value })}
            >
              {holdModes.map((mode, n) => (
                <option value={n} key={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="os-rk-form-grid">
            <label className="os-rk-field">
              <span>Threshold ({rule.unit})</span>
              <input
                className="form-control"
                type="number"
                required
                min={spec.min}
                max={
                  rule.id === "stake" && rule.unit === "% equity"
                    ? 100
                    : spec.max
                }
                step={
                  ["dailyLoss", "stake", "symbol", "asset", "margin"].includes(
                    rule.id,
                  )
                    ? "any"
                    : 1
                }
                value={Number.isNaN(rule.value) ? "" : rule.value}
                onChange={(e) =>
                  setRule({ ...rule, value: e.target.valueAsNumber })
                }
              />
            </label>
            {rule.id === "stake" && (
              <label className="os-rk-field">
                <span>Threshold unit</span>
                <select
                  className="form-select"
                  value={rule.unit}
                  onChange={(e) =>
                    setRule({
                      ...rule,
                      unit: e.target.value,
                      value: e.target.value === "% equity" ? 2 : 200,
                    })
                  }
                >
                  <option>USD</option>
                  <option>% equity</option>
                </select>
              </label>
            )}
            {rule.id === "openCount" && rule.scope === "all" && (
              <label className="os-rk-field">
                <span>Count positions</span>
                <select
                  className="form-select"
                  value={rule.unit}
                  onChange={(e) => setRule({ ...rule, unit: e.target.value })}
                >
                  <option value="positions">Per profile</option>
                  <option value="positions total">Across the workspace</option>
                </select>
              </label>
            )}
          </div>
        )}
        <Code value={code} set={setCode} />
        <ErrorText error={mut.error} />
        <div className="os-rk-actions">
          <Btn onClick={close} disabled={mut.isPending}>
            Cancel
          </Btn>
          <Btn type="submit" kind="primary" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save risk rule"}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
export function Receipts() {
  const q = useQuery({
    queryKey: ["risk", "receipts"],
    queryFn: getRiskReceipts,
  });
  const [chosen, setChosen] = useState<RiskReceipt>(),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState("All");
  const rows =
    q.data?.filter((r) => filter === "All" || r.status === filter) ?? [];
  const cols: ColumnDef<RiskReceipt, unknown>[] = [
    {
      id: "account",
      header: "Account / receipt",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.accountLabel}</strong>
          <small className="os-rk-mono">{r.id}</small>
        </>
      ),
    },
    {
      id: "positions",
      header: "Closed / reviewed",
      cell: ({ row: { original: r } }) => `${r.closed} / ${r.attempted}`,
    },
    {
      id: "result",
      header: "Outcome",
      cell: ({ row: { original: r } }) => (
        <>
          <Tag tone={r.status === "Simulated" ? "green" : "amber"}>
            {r.status}
          </Tag>
          <small>{r.detail}</small>
        </>
      ),
    },
    {
      id: "refs",
      header: "Position refs",
      cell: ({ row: { original: r } }) => (
        <span className="os-rk-mono">{r.refs.join(" · ") || "—"}</span>
      ),
    },
    {
      id: "retry",
      header: "Retry",
      cell: ({ row: { original: r } }) =>
        r.attempted > r.closed ? (
          <Btn onClick={() => setChosen(r)}>Review retry</Btn>
        ) : (
          <span className="os-rk-muted">—</span>
        ),
    },
  ];
  return (
    <div className="os-rk-card">
      <div className="os-rk-toolbar">
        <div>
          <strong>Close-all completion report</strong>
          <small>
            Paper closures book to Records. Offline positions never change.
          </small>
        </div>
        <label className="os-rk-field">
          <span>Filter receipts</span>
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["All", "Simulated", "Offline", "Needs review"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <div className="os-rk-inline">
          <Note>{notice}</Note>
        </div>
      )}
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <ErrorText error={q.error} />
      ) : q.data?.length ? (
        <RiskTable rows={rows} cols={cols} label="Close-all receipts" />
      ) : (
        <div className="os-rk-empty">
          <FileCheck2 size={22} />
          <strong>No close-all receipts yet</strong>
          <span>
            A report is generated when you confirm a close-all review.
          </span>
        </div>
      )}
      <div className="os-rk-inline os-rk-actions">
        <Link className="os-rk-link" to="/dashboard/records">
          Open Records <ArrowUpRight size={14} />
        </Link>
        <Link className="os-rk-link" to="/dashboard/positions">
          Open positions <ArrowUpRight size={14} />
        </Link>
      </div>
      {chosen && (
        <ProtectedControl
          title={`Retry ${chosen.id}`}
          detail="Only still-open positions from this original receipt are eligible. Broker retry is an offline validation."
          action="retry"
          id={chosen.id}
          close={() => setChosen(undefined)}
          onDone={(text) => {
            setNotice(text);
            setChosen(undefined);
          }}
        />
      )}
    </div>
  );
}
