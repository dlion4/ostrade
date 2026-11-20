import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BellPlus,
  CirclePause,
  FlaskConical,
  Settings2,
  Timer,
} from "lucide-react";
import {
  alertKinds,
  channels,
  changeAlertRule,
  checkAlertRules,
  createAlertRule,
  getAlertCatalog,
  getAlertRules,
  notificationTime,
  type AlertDraft,
  type AlertKind,
  type AlertRule,
} from "@/services/notifications";
import {
  Busy,
  Button,
  ChannelName,
  Drawer,
  Failure,
  Message,
  PanelHead,
  Table,
  Tag,
} from "./NotificationUI";

export function AlertRules() {
  const [create, setCreate] = useState(false),
    [edit, setEdit] = useState<AlertRule>(),
    [notice, setNotice] = useState(""),
    [showAll, setAll] = useState(false),
    [filter, setFilter] = useState("All"),
    [inspect, setInspect] = useState(false);
  const q = useQuery({
    queryKey: ["notifications", "rules"],
    queryFn: getAlertRules,
  });
  const scan = useMutation({
    mutationFn: checkAlertRules,
    onSuccess: (r) =>
      setNotice(
        `Checked ${r.checked} active conditions · ${r.fired} new match${r.fired === 1 ? "" : "es"}. No price tick or provider request.`,
      ),
  });
  const rows = (q.data ?? []).filter(
    (r) => filter === "All" || r.status === filter,
  );
  const cols: ColumnDef<AlertRule, unknown>[] = [
    {
      id: "rule",
      header: "Alert rule",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.title}</strong>
          <small>
            {r.source} · {r.repeat ? "Recurring" : "One-shot"}
          </small>
        </>
      ),
    },
    {
      id: "condition",
      header: "Condition",
      cell: ({ row: { original: r } }) => (
        <>
          <code>
            {r.kind === "EVENT"
              ? `${r.threshold} min before`
              : `${r.direction} ${r.threshold}${r.kind === "PNL" ? " USD" : r.kind === "MARGIN" || r.kind === "PCT_MOVE" ? "%" : ""}`}
          </code>
          {r.basis && (
            <small>
              {r.basis === "Open" ? "Since sample open" : "24-hour snapshot"}
            </small>
          )}
        </>
      ),
    },
    {
      id: "channels",
      header: "Channels",
      cell: ({ row: { original: r } }) => (
        <div className="os-nt-actions">
          {r.channels.map((ch) => (
            <Tag key={ch}>
              <ChannelName channel={ch} />
            </Tag>
          ))}
        </div>
      ),
    },
    {
      id: "status",
      header: "State",
      cell: ({ row: { original: r } }) => (
        <>
          <Tag
            tone={
              r.status === "Active"
                ? "teal"
                : r.status === "Snoozed"
                  ? "amber"
                  : "neutral"
            }
          >
            {r.status}
          </Tag>
          {r.status === "Snoozed" && r.snoozedUntil && (
            <small>Until {notificationTime(r.snoozedUntil)} EAT</small>
          )}
        </>
      ),
    },
    {
      id: "fired",
      header: "Fired",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.firedCount}</strong>
          {r.lastFiredAt && (
            <small>{notificationTime(r.lastFiredAt)} EAT</small>
          )}
        </>
      ),
    },
    {
      id: "action",
      header: "Manage",
      cell: ({ row: { original: r } }) => (
        <Button
          disabled={scan.isPending}
          onClick={() => setEdit(r)}
          aria-label={`Manage ${r.title}`}
        >
          <Settings2 size={14} /> Manage
        </Button>
      ),
    },
  ];
  return (
    <div className="os-nt-card">
      <div className="os-nt-toolbar">
        <PanelHead
          eyebrow="FIXED-SNAPSHOT MONITOR"
          title="Threshold alerts"
          copy="Run a snapshot check to detect a new match. Nothing runs in the background."
        />
        <div className="os-nt-actions">
          <Button
            onClick={() => scan.mutate()}
            disabled={scan.isPending || q.isPending}
          >
            <FlaskConical size={15} />{" "}
            {scan.isPending ? "Checking…" : "Check snapshot"}
          </Button>
          <Button
            kind="primary"
            onClick={() => setCreate(true)}
            disabled={scan.isPending}
          >
            <BellPlus size={15} /> New alert rule
          </Button>
        </div>
      </div>
      <div className="os-nt-inbox-controls">
        <label className="os-nt-field">
          <span>Alert state</span>
          <select
            className="form-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setAll(false);
            }}
          >
            {["All", "Active", "Paused", "Snoozed", "Completed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Link to="/dashboard/markets" className="os-nt-link">
          Markets & calendar <ArrowUpRight size={14} />
        </Link>
      </div>
      {notice && (
        <div className="os-nt-inline">
          <Message>
            {notice}{" "}
            {scan.data && (
              <button
                type="button"
                className="os-nt-link"
                onClick={() => setInspect(true)}
              >
                View last scan
              </button>
            )}
          </Message>
        </div>
      )}
      <Failure error={scan.error} />
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <div className="os-nt-inline">
          <Failure error={q.error} />
          <Button onClick={() => void q.refetch()}>Retry rules</Button>
        </div>
      ) : (
        <Table
          rows={showAll ? rows : rows.slice(0, 6)}
          cols={cols}
          label="Alert rules"
        />
      )}
      {rows.length > 6 && (
        <div className="os-nt-inline">
          <Button onClick={() => setAll(!showAll)}>
            {showAll ? "Show fewer rules" : `View all ${rows.length} rules`}
          </Button>
        </div>
      )}
      {create && (
        <AlertBuilder
          onClose={() => setCreate(false)}
          onCreated={(r) => {
            setCreate(false);
            setNotice(`${r.title} saved. Use Check snapshot to evaluate it.`);
            setFilter("All");
          }}
        />
      )}
      {edit && (
        <RuleManager
          rule={edit}
          onClose={() => setEdit(undefined)}
          onDone={(text) => {
            setEdit(undefined);
            setNotice(text);
          }}
        />
      )}
      {inspect && scan.data && (
        <Drawer
          title="Last snapshot evaluation"
          kicker="RULE EVIDENCE"
          onClose={() => setInspect(false)}
        >
          <ul className="os-nt-evidence">
            {scan.data.output.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.title}</strong>
                  <small>Observed: {r.observed}</small>
                </span>
                <Tag tone={r.outcome === "Triggered" ? "teal" : "neutral"}>
                  {r.outcome}
                </Tag>
              </li>
            ))}
          </ul>
        </Drawer>
      )}
    </div>
  );
}
function AlertBuilder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: AlertRule) => void;
}) {
  const [draft, setDraft] = useState<AlertDraft>({
    kind: "PRICE",
    target: "",
    direction: "above",
    threshold: NaN,
    basis: "24h",
    repeat: false,
    channels: ["In-app", "Push"],
  });
  const q = useQuery({
    queryKey: ["notifications", "alert-catalog"],
    queryFn: getAlertCatalog,
  });
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => createAlertRule(draft),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["price-alerts"] });
      onCreated(r);
    },
  });
  const list =
    draft.kind === "EVENT"
      ? q.data?.events
      : draft.kind === "MARGIN" || draft.kind === "PNL"
        ? q.data?.accounts
        : q.data?.markets;
  const name =
    draft.kind === "EVENT"
      ? "Calendar event"
      : draft.kind === "MARGIN" || draft.kind === "PNL"
        ? "Account profile"
        : "Instrument";
  const update = <K extends keyof AlertDraft>(k: K, v: AlertDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Drawer
      title="Create an alert rule"
      kicker="LOCAL THRESHOLD BUILDER"
      onClose={onClose}
      busy={m.isPending}
    >
      <form
        className="os-nt-flow"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label className="os-nt-field">
          <span>Alert type</span>
          <select
            className="form-select"
            value={draft.kind}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                kind: e.target.value as AlertKind,
                target: "",
                threshold: e.target.value === "EVENT" ? 15 : NaN,
              }))
            }
          >
            {alertKinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <small>{alertKinds.find((k) => k.id === draft.kind)?.detail}</small>
        </label>
        <label className="os-nt-field">
          <span>{name}</span>
          <select
            className="form-select"
            value={draft.target}
            required
            disabled={q.isPending}
            onChange={(e) => update("target", e.target.value)}
          >
            <option value="">Select {name.toLowerCase()}</option>
            {list?.map((t) => (
              <option value={t.id} key={t.id}>
                {t.label}
                {"time" in t ? ` · ${t.time}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="os-nt-form-grid">
          {draft.kind !== "EVENT" && (
            <label className="os-nt-field">
              <span>Direction</span>
              <select
                className="form-select"
                value={draft.direction}
                onChange={(e) =>
                  update("direction", e.target.value as AlertDraft["direction"])
                }
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </label>
          )}
          <label className="os-nt-field">
            <span>
              {draft.kind === "EVENT"
                ? "Lead time (minutes)"
                : draft.kind === "PNL"
                  ? "Threshold (USD)"
                  : draft.kind === "PRICE"
                    ? "Price threshold"
                    : "Threshold (%)"}
            </span>
            <input
              className="form-control"
              type="number"
              required
              min={
                draft.kind === "EVENT"
                  ? 5
                  : draft.kind === "PRICE"
                    ? 0.00000001
                    : draft.kind === "MARGIN"
                      ? 1
                      : undefined
              }
              max={draft.kind === "EVENT" ? 240 : undefined}
              step={draft.kind === "EVENT" ? 1 : "any"}
              value={Number.isFinite(draft.threshold) ? draft.threshold : ""}
              onChange={(e) => update("threshold", e.target.valueAsNumber)}
            />
          </label>
          {draft.kind === "PCT_MOVE" && (
            <label className="os-nt-field">
              <span>Move basis</span>
              <select
                className="form-select"
                value={draft.basis}
                onChange={(e) =>
                  update("basis", e.target.value as AlertDraft["basis"])
                }
              >
                <option value="24h">Last 24 hours</option>
                <option value="Open">Since sample open</option>
              </select>
            </label>
          )}
          {draft.kind !== "EVENT" && (
            <label className="os-nt-field">
              <span>Frequency</span>
              <select
                className="form-select"
                value={draft.repeat ? "repeat" : "once"}
                onChange={(e) => update("repeat", e.target.value === "repeat")}
              >
                <option value="once">One-shot</option>
                <option value="repeat">Recurring on a new match</option>
              </select>
            </label>
          )}
        </div>
        <fieldset className="os-nt-flow">
          <legend>Route on match</legend>
          <div className="os-nt-choice-grid">
            {channels.map((ch) => (
              <label className="os-nt-option" key={ch}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={draft.channels.includes(ch)}
                  disabled={ch === "In-app"}
                  onChange={(e) =>
                    update(
                      "channels",
                      e.target.checked
                        ? [...draft.channels, ch]
                        : draft.channels.filter((c) => c !== ch),
                    )
                  }
                />
                <ChannelName channel={ch} />
              </label>
            ))}
          </div>
          <small className="os-nt-muted">
            External channels only create routing proofs. In-app is included.
          </small>
        </fieldset>
        <Failure error={q.error ?? m.error} />
        <div className="os-nt-actions">
          <Button onClick={onClose} disabled={m.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            kind="primary"
            disabled={m.isPending || q.isPending}
          >
            {m.isPending ? "Saving…" : "Save alert rule"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
function RuleManager({
  rule,
  onClose,
  onDone,
}: {
  rule: AlertRule;
  onClose: () => void;
  onDone: (s: string) => void;
}) {
  const [minutes, setMinutes] = useState(60),
    [remove, setRemove] = useState(false);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (action: "pause" | "activate" | "snooze" | "delete") =>
      changeAlertRule({ id: rule.id, action, minutes }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["price-alerts"] });
      onDone(r.message);
    },
  });
  return (
    <Drawer
      title={rule.title}
      kicker="MANAGE LOCAL RULE"
      onClose={onClose}
      busy={mut.isPending}
    >
      <div className="os-nt-flow">
        <div className="os-nt-actions">
          <Tag tone={rule.status === "Active" ? "teal" : "neutral"}>
            {rule.status}
          </Tag>
          <Tag>{rule.firedCount} triggered</Tag>
        </div>
        {rule.status !== "Completed" && (
          <>
            <Button
              onClick={() =>
                mut.mutate(rule.status === "Active" ? "pause" : "activate")
              }
              disabled={mut.isPending}
            >
              <CirclePause size={15} />
              {rule.status === "Active" ? "Pause rule" : "Activate rule"}
            </Button>
            <label className="os-nt-field">
              <span>Snooze duration</span>
              <select
                className="form-select"
                value={minutes}
                onChange={(e) => setMinutes(+e.target.value)}
              >
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
              </select>
            </label>
            <Button
              disabled={mut.isPending}
              onClick={() => mut.mutate("snooze")}
            >
              <Timer size={15} /> Snooze rule
            </Button>
          </>
        )}
        {remove ? (
          <Message>
            Remove this rule from the shared alert list? Existing notices are
            kept.
          </Message>
        ) : null}
        <Failure error={mut.error} />
        <div className="os-nt-actions">
          {remove && (
            <Button disabled={mut.isPending} onClick={() => setRemove(false)}>
              Keep rule
            </Button>
          )}
          <Button
            kind="danger"
            disabled={mut.isPending}
            onClick={() => (remove ? mut.mutate("delete") : setRemove(true))}
          >
            {remove ? "Confirm remove" : "Remove rule"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
