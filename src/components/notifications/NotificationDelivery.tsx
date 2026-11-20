import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Clock3,
  FileText,
  FlaskConical,
  Moon,
  ShieldCheck,
} from "lucide-react";
import {
  channels,
  deliveryTargets,
  digestSections,
  exportDeliveryProof,
  getDeliveryLog,
  getDeliveryPreferences,
  getDigestPreview,
  getDigestSettings,
  notificationTime,
  queueDigestReport,
  runFallbackReview,
  saveDeliveryPolicy,
  saveDigestSettings,
  saveQuietHours,
  smsCost,
  testNotificationChannel,
  type Channel,
  type Delivery,
  type DeliveryPolicy,
  type DigestSettings,
  type QuietPolicy,
} from "@/services/notifications";
import {
  Button,
  Busy,
  ChannelName,
  deliveryTone,
  Drawer,
  Failure,
  Message,
  PanelHead,
  Table,
  Tag,
} from "./NotificationUI";

export function Digests() {
  const q = useQuery({
    queryKey: ["notifications", "digest"],
    queryFn: getDigestSettings,
  });
  return q.isPending ? (
    <div className="os-nt-card">
      <Busy />
    </div>
  ) : q.isError ? (
    <Failure error={q.error} />
  ) : (
    <DigestForm initial={q.data} />
  );
}
function DigestForm({ initial }: { initial: DigestSettings }) {
  const [settings, setSettings] = useState(initial),
    [notice, setNotice] = useState(""),
    [view, setView] = useState(false);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => saveDigestSettings(settings),
    onSuccess: (r) => {
      setNotice(r.message);
      void qc.invalidateQueries({ queryKey: ["notifications", "digest"] });
    },
  });
  const preview = useMutation({
    mutationFn: getDigestPreview,
    onSuccess: () => setView(true),
  });
  const pdf = useMutation({
    mutationFn: queueDigestReport,
    onSuccess: (r) => {
      setNotice(r.message);
      void qc.invalidateQueries({ queryKey: ["record-exports"] });
    },
  });
  const dirty =
    JSON.stringify({
      ...settings,
      contents: digestSections.filter((s) => settings.contents.includes(s)),
    }) !==
    JSON.stringify(qc.getQueryData(["notifications", "digest"]) ?? initial);
  return (
    <div className="os-nt-grid os-nt-digest-grid">
      <form
        className="os-nt-card os-nt-panel"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <PanelHead
          eyebrow="YOUR TRADING SUMMARY"
          title="Daily briefing preferences"
          copy="Choose the contents and time for the next preview."
          action={
            <span className="os-nt-icon os-nt-teal">
              <FileText size={18} />
            </span>
          }
        />
        <div className="os-nt-form-grid">
          <label className="form-check form-switch os-nt-check">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={settings.daily}
              onChange={(e) =>
                setSettings({ ...settings, daily: e.target.checked })
              }
            />{" "}
            Daily digest enabled
          </label>
          <label className="os-nt-field">
            <span>Daily digest time (EAT)</span>
            <input
              type="time"
              className="form-control"
              required
              value={settings.time}
              onChange={(e) =>
                setSettings({ ...settings, time: e.target.value })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend>Daily sections</legend>
          <div className="os-nt-choice-grid">
            {digestSections.map((s) => (
              <label className="os-nt-option" key={s}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.contents.includes(s)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      contents: e.target.checked
                        ? [...settings.contents, s]
                        : settings.contents.filter((x) => x !== s),
                    })
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="os-nt-actions">
          <Button type="submit" kind="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save digest preferences"}
          </Button>
          <Button
            onClick={() => preview.mutate()}
            disabled={preview.isPending || save.isPending || dirty}
          >
            {preview.isPending ? "Preparing…" : "Preview saved digest"}
          </Button>
        </div>
        {dirty && (
          <small className="os-nt-muted">
            Save your edits before previewing the new settings.
          </small>
        )}
        {notice && <Message>{notice}</Message>}
        <Failure error={save.error ?? preview.error ?? pdf.error} />
      </form>
      <aside className="os-nt-card os-nt-panel">
        <PanelHead
          eyebrow="RECORDS & LEDGER"
          title="Weekly and monthly reports"
          copy="Set preferences here, then open the local file in its originating workspace."
        />
        <label className="form-check form-switch os-nt-check">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            checked={settings.weekly}
            onChange={(e) =>
              setSettings({
                ...settings,
                weekly: e.target.checked,
                attachPdf: e.target.checked && settings.attachPdf,
              })
            }
          />{" "}
          Weekly report
        </label>
        <label className="form-check os-nt-check">
          <input
            className="form-check-input"
            type="checkbox"
            disabled={!settings.weekly}
            checked={settings.attachPdf}
            onChange={(e) =>
              setSettings({ ...settings, attachPdf: e.target.checked })
            }
          />{" "}
          Include weekly Records PDF
        </label>
        <label className="form-check form-switch os-nt-check">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            checked={settings.monthly}
            onChange={(e) =>
              setSettings({ ...settings, monthly: e.target.checked })
            }
          />{" "}
          Include monthly statement link
        </label>
        <div className="os-nt-actions">
          <Button
            disabled={dirty || !settings.attachPdf || pdf.isPending}
            onClick={() => pdf.mutate()}
          >
            <ArrowDownToLine size={15} />{" "}
            {pdf.isPending ? "Queuing PDF…" : "Queue weekly PDF"}
          </Button>
          <Link
            to="/dashboard/records"
            hash="records-exports"
            className="os-nt-link"
          >
            Records export center <ArrowUpRight size={14} />
          </Link>
        </div>
        <Link
          to="/dashboard/transfers"
          hash="tl-statements"
          className="os-nt-link"
        >
          Monthly statements <ArrowUpRight size={14} />
        </Link>
        <small className="os-nt-muted">
          Email and scheduled delivery are not available in the frontend demo.
        </small>
      </aside>
      {view && preview.data && (
        <Drawer
          title="Daily digest preview"
          kicker={`${preview.data.date} · ${preview.data.time} EAT`}
          onClose={() => setView(false)}
        >
          <div className="os-nt-flow">
            <Tag tone="teal">
              {preview.data.settings.daily
                ? "Next digest preview"
                : "Daily digest disabled · manual preview"}
            </Tag>
            {preview.data.sections.map((s) => (
              <div className="os-nt-inset" key={s.label}>
                <strong>{s.label}</strong>
                <ul>
                  {s.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
            {preview.data.settings.weekly &&
              preview.data.settings.attachPdf && (
                <div className="os-nt-inset">
                  <strong>Weekly attachment</strong>
                  <p>
                    {preview.data.pdf ??
                      "No ready PDF yet. Queue the weekly report or open the Records export center."}
                  </p>
                  <Link to="/dashboard/records" className="os-nt-link">
                    Open Records <ArrowUpRight size={13} />
                  </Link>
                </div>
              )}
            {preview.data.settings.monthly && (
              <Link to="/dashboard/transfers" className="os-nt-link">
                Open monthly statements <ArrowUpRight size={13} />
              </Link>
            )}
            <small className="os-nt-muted">
              Generated from a fixed local snapshot. Nothing was scheduled or
              sent.
            </small>
          </div>
        </Drawer>
      )}
    </div>
  );
}
function deliveryQuery() {
  return {
    queryKey: ["notifications", "delivery-policy"],
    queryFn: getDeliveryPreferences,
  };
}
export function QuietHours() {
  const q = useQuery(deliveryQuery());
  return q.isPending ? (
    <div className="os-nt-card">
      <Busy />
    </div>
  ) : q.isError ? (
    <Failure error={q.error} />
  ) : (
    <QuietForm
      initial={q.data.quiet}
      clock={q.data.clock}
      isQuiet={q.data.quietNow}
    />
  );
}
function QuietForm({
  initial,
  clock,
  isQuiet,
}: {
  initial: QuietPolicy;
  clock: string;
  isQuiet: boolean;
}) {
  const [value, setValue] = useState(initial),
    [notice, setNotice] = useState("");
  const save = useMutation({
    mutationFn: () => saveQuietHours(value),
    onSuccess: (r) => setNotice(r.message),
  });
  return (
    <div className="os-nt-grid os-nt-quiet-grid">
      <form
        className="os-nt-card os-nt-panel"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <PanelHead
          eyebrow="EAT · UTC+3"
          title="Quiet window"
          copy="Pause noncritical external routes while the local inbox stays available."
          action={
            <span className="os-nt-icon os-nt-blue">
              <Moon size={18} />
            </span>
          }
        />
        <label className="form-check form-switch os-nt-check">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />{" "}
          Enable quiet hours
        </label>
        <div className="os-nt-form-grid">
          <label className="os-nt-field">
            <span>Quiet hours start (EAT)</span>
            <input
              type="time"
              className="form-control"
              required
              value={value.start}
              onChange={(e) => setValue({ ...value, start: e.target.value })}
            />
          </label>
          <label className="os-nt-field">
            <span>Quiet hours end (EAT)</span>
            <input
              type="time"
              className="form-control"
              required
              value={value.end}
              onChange={(e) => setValue({ ...value, end: e.target.value })}
            />
          </label>
        </div>
        <div className="os-nt-actions">
          <Button type="submit" kind="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save quiet hours"}
          </Button>
          <Tag>
            {value.start > value.end ? "Overnight window" : "Same-day window"}
          </Tag>
        </div>
        {notice && <Message>{notice}</Message>}
        <Failure error={save.error} />
      </form>
      <aside className="os-nt-card os-nt-panel">
        <PanelHead
          eyebrow="SAVED POLICY"
          title="Critical bypass"
          action={
            <Tag tone={isQuiet ? "amber" : "teal"}>
              <Clock3 size={13} /> {clock} EAT snapshot
            </Tag>
          }
        />
        <div className="os-nt-inset">
          <strong>
            <ShieldCheck size={15} /> Critical routes ignore quiet hours
          </strong>
          <p>
            Kill-switch engagements, margin calls, adapter disconnects and
            critical guardrail notices remain visible in-app. External previews
            still respect route caps.
          </p>
        </div>
        <p>
          {initial.enabled
            ? `Saved quiet window: ${initial.start}–${initial.end} EAT. ${isQuiet ? "Active at this snapshot." : "Outside the window at this snapshot."}`
            : "Quiet hours are currently off."}
        </p>
        <small className="os-nt-muted">
          Suppressed routes are logged, not queued for later delivery.
        </small>
      </aside>
    </div>
  );
}
export function Deliverability() {
  const q = useQuery(deliveryQuery());
  return q.isPending ? (
    <div className="os-nt-card">
      <Busy />
    </div>
  ) : q.isError ? (
    <Failure error={q.error} />
  ) : (
    <DeliveryForm data={q.data} />
  );
}
function DeliveryForm({
  data,
}: {
  data: Awaited<ReturnType<typeof getDeliveryPreferences>>;
}) {
  const [policy, setPolicy] = useState<DeliveryPolicy>(data.delivery),
    [notice, setNotice] = useState(""),
    [proof, setProof] = useState<Delivery>();
  const save = useMutation({
    mutationFn: () => saveDeliveryPolicy(policy),
    onSuccess: (r) => setNotice(r.message),
  });
  const test = useMutation({
    mutationFn: (channel: Channel | "M-Pesa") =>
      testNotificationChannel(
        channel === "M-Pesa"
          ? { channel: "SMS", nativeSms: true }
          : { channel },
      ),
    onSuccess: (r) => setProof(r),
  });
  const fallback = useMutation({
    mutationFn: runFallbackReview,
    onSuccess: (r) =>
      setNotice(
        r.matched
          ? `${r.matched} eligible critical notice(s) · ${r.previews} SMS previews · ${r.blocked} capped.`
          : "No eligible unread critical Push notices. No messages were sent.",
      ),
  });
  return (
    <div className="os-nt-card">
      <div className="os-nt-toolbar">
        <PanelHead
          eyebrow="ROUTING REHEARSAL"
          title="Channel diagnostics & rate limits"
          copy="Test the saved policies. External channels never dispatch to providers."
        />
        <Tag tone="blue">No services connected</Tag>
      </div>
      <div className="os-nt-provider-grid">
        {channels.map((ch) => (
          <article key={ch}>
            <span className="os-nt-icon os-nt-teal">
              <ChannelName channel={ch} />
            </span>
            <strong>{deliveryTargets[ch].provider}</strong>
            <small>{deliveryTargets[ch].target}</small>
            <div className="os-nt-usage">
              {data.usage[ch]} / {data.delivery.limits[ch]} routed today
            </div>
            <Button
              onClick={() => test.mutate(ch)}
              disabled={test.isPending || save.isPending}
              aria-label={`Test ${ch}`}
            >
              {test.isPending && test.variables === ch
                ? "Testing…"
                : "Test route"}
            </Button>
          </article>
        ))}
      </div>
      <form
        className="os-nt-rate-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="os-nt-form-grid">
          <label className="os-nt-field">
            <span>SMS daily budget (KES)</span>
            <input
              className="form-control"
              type="number"
              min={0}
              max={1000}
              step=".01"
              required
              value={Number.isFinite(policy.smsBudget) ? policy.smsBudget : ""}
              onChange={(e) =>
                setPolicy({ ...policy, smsBudget: e.target.valueAsNumber })
              }
            />
            <small>
              Estimate: KES {data.usage.smsSpend.toFixed(2)} used ·{" "}
              {smsCost.toFixed(2)} per preview.
            </small>
          </label>
          <div className="os-nt-flow">
            <label className="form-check form-switch os-nt-check">
              <input
                className="form-check-input"
                role="switch"
                type="checkbox"
                checked={policy.fallback}
                onChange={(e) =>
                  setPolicy({ ...policy, fallback: e.target.checked })
                }
              />{" "}
              Enable critical Push → SMS fallback
            </label>
            <label className="form-check form-switch os-nt-check">
              <input
                className="form-check-input"
                role="switch"
                type="checkbox"
                checked={policy.nativeDedupe}
                onChange={(e) =>
                  setPolicy({ ...policy, nativeDedupe: e.target.checked })
                }
              />{" "}
              Suppress duplicate native M-Pesa SMS
            </label>
          </div>
        </div>
        <div className="os-nt-rate-grid">
          {channels.map((ch) => (
            <label className="os-nt-field" key={ch}>
              <span>{ch} daily cap</span>
              <input
                className="form-control"
                type="number"
                min={ch === "In-app" ? 1 : 0}
                max={ch === "SMS" ? 100 : 1000}
                step={1}
                required
                value={
                  Number.isFinite(policy.limits[ch]) ? policy.limits[ch] : ""
                }
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    limits: { ...policy.limits, [ch]: e.target.valueAsNumber },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="os-nt-actions">
          <Button type="submit" kind="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save delivery policy"}
          </Button>
          <Button
            onClick={() => test.mutate("M-Pesa")}
            disabled={test.isPending}
          >
            Test native SMS dedupe
          </Button>
          <Button
            disabled={fallback.isPending || !data.delivery.fallback}
            onClick={() => fallback.mutate()}
          >
            <FlaskConical size={15} />{" "}
            {fallback.isPending ? "Reviewing…" : "Review critical fallback"}
          </Button>
        </div>
        <small className="os-nt-muted">
          Only unread critical notices with a Push preview at least 10 minutes
          old qualify. This manual check never sends an SMS.
        </small>
      </form>
      {notice && (
        <div className="os-nt-inline">
          <Message>{notice}</Message>
        </div>
      )}
      <Failure error={save.error ?? test.error ?? fallback.error} />
      {proof && (
        <ProofDialog proof={proof} onClose={() => setProof(undefined)} />
      )}
    </div>
  );
}
function ProofDialog({
  proof,
  onClose,
}: {
  proof: Delivery;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={proof.subject}
      kicker={`${proof.mode.toUpperCase()} · ROUTING PROOF`}
      onClose={onClose}
    >
      <div className="os-nt-flow">
        <div className="os-nt-actions">
          <Tag tone={deliveryTone(proof.status)}>{proof.status}</Tag>
          <Tag>
            <ChannelName channel={proof.channel} />
          </Tag>
        </div>
        <div className="os-nt-facts">
          <div>
            <span>Proof ref</span>
            <code>{proof.id}</code>
          </div>
          <div>
            <span>Target</span>
            <strong>{proof.target}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{notificationTime(proof.createdAt)} EAT</strong>
          </div>
          {proof.notificationId && (
            <div>
              <span>Notice ref</span>
              <code>{proof.notificationId}</code>
            </div>
          )}
        </div>
        <Message>{proof.detail}</Message>
        {proof.channel !== "In-app" && (
          <small className="os-nt-muted">
            <Ban size={13} /> This is not a provider delivery receipt.
          </small>
        )}
        <Button onClick={onClose}>Done</Button>
      </div>
    </Drawer>
  );
}
export function DeliveryLog() {
  const q = useQuery({
    queryKey: ["notifications", "delivery-log"],
    queryFn: getDeliveryLog,
  });
  const [mode, setMode] = useState("All"),
    [channel, setChannel] = useState("All"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Delivery>(),
    [notice, setNotice] = useState("");
  const rows = (q.data ?? []).filter(
    (r) =>
      (mode === "All" || r.mode === mode) &&
      (channel === "All" || r.channel === channel),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 7)),
    index = Math.min(page, pages - 1);
  const exportProof = useMutation({
    mutationFn: () => exportDeliveryProof(rows.map((r) => r.id)),
    onSuccess: (r) => {
      const url = URL.createObjectURL(
        new Blob([r.text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = r.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${r.count} proofs exported.`);
    },
  });
  const cols: ColumnDef<Delivery, unknown>[] = [
    {
      id: "time",
      header: "Time (EAT)",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{notificationTime(r.createdAt)}</strong>
          <small>{r.mode}</small>
        </>
      ),
    },
    {
      id: "subject",
      header: "Subject / reference",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.subject}</strong>
          <small>
            <code>{r.id}</code>
          </small>
        </>
      ),
    },
    {
      id: "channel",
      header: "Channel",
      cell: ({ row: { original: r } }) => (
        <>
          <Tag>
            <ChannelName channel={r.channel} />
          </Tag>
          <small>{r.target}</small>
        </>
      ),
    },
    {
      id: "status",
      header: "Routing outcome",
      cell: ({ row: { original: r } }) => (
        <Tag tone={deliveryTone(r.status)}>{r.status}</Tag>
      ),
    },
    {
      id: "proof",
      header: "Evidence",
      cell: ({ row: { original: r } }) => (
        <Button onClick={() => setSelected(r)}>
          View proof <ArrowRight size={13} />
        </Button>
      ),
    },
  ];
  return (
    <div className="os-nt-card">
      <div className="os-nt-toolbar">
        <PanelHead
          eyebrow="DELIVERY EVIDENCE"
          title="Routing proof log"
          copy="Inspect test envelopes, policy skips, and in-app delivery from this session."
        />
        <Button
          disabled={!rows.length || exportProof.isPending}
          onClick={() => exportProof.mutate()}
        >
          <ArrowDownToLine size={15} /> Export proof JSON
        </Button>
      </div>
      <div className="os-nt-inbox-controls">
        <label className="os-nt-field">
          <span>Proof channel</span>
          <select
            className="form-select"
            value={channel}
            onChange={(e) => {
              setPage(0);
              setChannel(e.target.value);
            }}
          >
            {["All", ...channels].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="os-nt-field">
          <span>Proof type</span>
          <select
            className="form-select"
            value={mode}
            onChange={(e) => {
              setPage(0);
              setMode(e.target.value);
            }}
          >
            {["All", "Test", "Event", "Fallback", "Sample"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <div className="os-nt-inline">
          <Message>{notice}</Message>
        </div>
      )}
      <Failure error={exportProof.error} />
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : (
        <Table
          rows={rows.slice(index * 7, (index + 1) * 7)}
          cols={cols}
          label="Notification delivery proof history"
        />
      )}
      <div className="os-nt-toolbar os-nt-pagination">
        <small>
          {rows.length} proofs · Page {index + 1} of {pages}
        </small>
        <div className="os-nt-actions">
          <Button disabled={index === 0} onClick={() => setPage(index - 1)}>
            Previous
          </Button>
          <Button
            disabled={index + 1 >= pages}
            onClick={() => setPage(index + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {selected && (
        <ProofDialog proof={selected} onClose={() => setSelected(undefined)} />
      )}
    </div>
  );
}
