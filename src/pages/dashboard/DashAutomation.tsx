import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  CalendarDays,
  Activity as ActivityIcon,
  ArrowRight,
  CalendarClock,
  Download,
  Hourglass,
  ListChecks,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
  Zap,
  Workflow,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  createSavedSignal,
  editSavedSignal,
  eatTime,
  deskScheduleSlot,
  getAutomationActivity,
  automationEventCsv,
  getTradingRules,
  saveTradingRules,
  removeSavedSignal,
  ruleLabels,
  scheduleSavedSignal,
  setAutomationControl,
  tradingRuleBounds,
  type AutomationEvent,
  type DeskSignal,
  type TradingRules,
} from "@/services/automation";
import { getSignals } from "@/services/signalDesk";
import { getAccounts, getSchedulesSummary, type DashboardMutationOutcome } from "@/services/dashboard";
import { marketSymbols } from "@/data/markets";
import { PageHero } from "@/components/PageHero";
import css from "@/styles/pages/dash-signal-automation.css?inline";

type AutomationTab = "signals" | "rules" | "activity";

const automationTabs: { id: AutomationTab; label: string; icon: typeof Zap }[] = [
  { id: "signals", label: "My signals", icon: Zap },
  { id: "rules", label: "Trading rules", icon: ShieldCheck },
  { id: "activity", label: "Activity", icon: ActivityIcon },
];

const statusChipClass: Record<string, string> = {
  Parsed: "is-info",
  Staged: "is-ready",
  Filled: "is-filled",
  Pending: "is-mute",
  Preview: "is-mute",
  Quarantined: "is-warn",
  Discarded: "is-mute",
};

const kindChipClass: Record<AutomationEvent["kind"], string> = {
  schedule: "is-schedule",
  signal: "is-signal",
  rules: "is-rules",
  control: "is-control",
};

function Skel({ h = 18, w = "100%" }: { h?: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w }} aria-hidden />;
}

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="os-auto-head">
      <div>
        <span className="os-auto-eyebrow">{eyebrow}</span>
        <h2 className="os-auto-h2">{title}</h2>
        {sub && <p className="os-auto-sub">{sub}</p>}
      </div>
    </div>
  );
}

function Banner({ outcome, onClose }: { outcome: DashboardMutationOutcome; onClose: () => void }) {
  return (
    <div className={`os-auto-banner is-${outcome.mode}`} role="status">
      <strong>{outcome.title}</strong>
      <span>{outcome.detail}</span>
      {outcome.mode === "simulated" && outcome.ref !== "—" && outcome.ref && (
        <span className="os-mono">Ref {outcome.ref}</span>
      )}
      <button type="button" className="os-icon-btn" aria-label="Dismiss notice" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}

function TabPanel({ tab, activeTab, children }: { tab: AutomationTab; activeTab: AutomationTab; children: ReactNode }) {
  return (
    <div
      className="os-auto-tabpanel"
      id={`auto-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`auto-tab-${tab}`}
      hidden={tab !== activeTab}
    >
      {children}
    </div>
  );
}

interface EditorState {
  id?: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry: string;
  sl: string;
  tp: string;
  size: string;
}

const blankEditor: EditorState = { symbol: "XAUUSD", side: "BUY", entry: "", sl: "", tp: "", size: "" };

const toNumber = (v: string) => {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : NaN;
};

export function DashAutomationPage() {
  const { recordSource } = useSearch({ from: "/dashboard/automation" });
  usePageStyle("dash-signal-automation", css);
  const toast = useToast();
  const qc = useQueryClient();
  const { killSwitch } = useDashboardContext();
  const recordNote = recordSource
    ? `Picked up from Signal Desk (${recordSource}). Review the figures, then save or schedule it.`
    : null;

  const [activeTab, setActiveTab] = useState<AutomationTab>("signals");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState("");
  const [scheduleFor, setScheduleFor] = useState<DeskSignal | null>(null);
  const [scheduleAt, setScheduleAt] = useState(deskScheduleSlot(30));
  const [scheduleAccountId, setScheduleAccountId] = useState("");
  const [banner, setBanner] = useState<DashboardMutationOutcome | null>(null);
  const [rulesForm, setRulesForm] = useState<Record<keyof TradingRules, string>>({
    maxLotsPerTrade: "",
    maxAmountPerTrade: "",
    maxAutomatedPerDay: "",
    autoPauseDailyLossPct: "",
  });
  const [rulesError, setRulesError] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [controlError, setControlError] = useState("");

  const signalsQ = useQuery({ queryKey: ["signals"], queryFn: getSignals, refetchOnMount: "always" });
  const schedulesQ = useQuery({ queryKey: ["scheduler-summary"], queryFn: getSchedulesSummary });
  const rulesQ = useQuery({ queryKey: ["automation-rules"], queryFn: getTradingRules });
  const activityQ = useQuery({ queryKey: ["automation-activity"], queryFn: getAutomationActivity });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });

  const accounts = accountsQ.data ?? [];
  const paperAccounts = useMemo(() => accounts.filter((a) => a.environment === "paper"), [accounts]);
  const signals = useMemo(
    () => (signalsQ.data ?? []).filter((s) => s.status !== "Discarded"),
    [signalsQ.data],
  );
  const pendingSchedules = (schedulesQ.data?.items ?? []).filter((s) => s.active);

  const refresh = (keys: string[]) => {
    for (const key of keys) void qc.invalidateQueries({ queryKey: [key] });
  };

  // Seed the rules form once the saved rules load (inputs stay editable afterwards).
  useEffect(() => {
    const saved = rulesQ.data;
    if (!saved || rulesForm.maxLotsPerTrade !== "") return;
    setRulesForm({
      maxLotsPerTrade: String(saved.maxLotsPerTrade),
      maxAmountPerTrade: String(saved.maxAmountPerTrade),
      maxAutomatedPerDay: String(saved.maxAutomatedPerDay),
      autoPauseDailyLossPct: String(saved.autoPauseDailyLossPct),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesQ.data]);

  const openEdit = (s: DeskSignal) => {
    setEditor({
      id: s.id,
      symbol: s.order.symbol,
      side: s.order.side === "SELL" ? "SELL" : "BUY",
      entry: String(s.order.entry),
      sl: String(s.order.sl),
      tp: String(s.order.targets[0] ?? ""),
      size: String(s.order.size),
    });
    setEditorError("");
  };

  const saveEditor = (thenSchedule: boolean) => {
    if (!editor) return;
    setEditorError("");
    const payload = {
      symbol: editor.symbol,
      side: editor.side,
      entry: toNumber(editor.entry),
      sl: toNumber(editor.sl),
      tp: toNumber(editor.tp),
      size: toNumber(editor.size),
    };
    const mut = editor.id ? editSavedSignal(editor.id, payload) : createSavedSignal(payload);
    mut
      .then((saved) => {
        toast(editor.id ? `Signal ${saved.id} updated` : `Signal saved as ${saved.id}`);
        refresh(["signals", "automation-activity"]);
        if (thenSchedule) {
          setScheduleFor(saved);
          setScheduleAt(deskScheduleSlot(30));
        } else {
          setEditor(null);
        }
      })
      .catch((e: Error) => setEditorError(e.message));
  };

  const saveRules = () => {
    setRulesError("");
    const payload: TradingRules = {
      maxLotsPerTrade: toNumber(rulesForm.maxLotsPerTrade),
      maxAmountPerTrade: toNumber(rulesForm.maxAmountPerTrade),
      maxAutomatedPerDay: toNumber(rulesForm.maxAutomatedPerDay),
      autoPauseDailyLossPct: toNumber(rulesForm.autoPauseDailyLossPct),
    };
    saveTradingRules(payload)
      .then((saved) => {
        toast("Trading rules saved");
        setRulesForm({
          maxLotsPerTrade: String(saved.maxLotsPerTrade),
          maxAmountPerTrade: String(saved.maxAmountPerTrade),
          maxAutomatedPerDay: String(saved.maxAutomatedPerDay),
          autoPauseDailyLossPct: String(saved.autoPauseDailyLossPct),
        });
        refresh(["automation-rules", "automation-activity"]);
      })
      .catch((e: Error) => setRulesError(e.message));
  };

  const submitSchedule = () => {
    if (!scheduleFor) return;
    scheduleSavedSignal(scheduleFor.id, scheduleAccountId || paperAccounts[0]?.id || "", scheduleAt)
      .then((outcome) => {
        setBanner(outcome);
        if (outcome.mode === "simulated") {
          toast(outcome.title);
          setScheduleFor(null);
        }
        refresh(["signals", "scheduler-summary", "scheduler-list", "records", "automation-activity"]);
      })
      .catch((e: Error) =>
        setBanner({ mode: "blocked", ref: "—", title: "Not scheduled", detail: e.message }),
      );
  };

  const runControl = (mode: "armed" | "paused" | "flattened") => {
    setControlError("");
    setConfirmStop(false);
    setAutomationControl(mode)
      .then((outcome) => {
        setBanner(outcome);
        toast(outcome.title);
        refresh(["accounts", "positions", "records", "scheduler-summary", "scheduler-list", "automation-activity", "signals"]);
      })
      .catch((e: Error) => setControlError(e.message));
  };

  const discard = (s: DeskSignal) => {
    removeSavedSignal(s.id)
      .then(() => {
        toast(`${s.id} discarded`);
        if (scheduleFor?.id === s.id) setScheduleFor(null);
        if (editor?.id === s.id) setEditor(null);
        refresh(["signals", "automation-activity"]);
      })
      .catch((e: Error) => toast(e.message));
  };

  const exportActivity = () => {
    const rows = activityQ.data ?? [];
    if (!rows.length) return;
    const blob = new Blob([automationEventCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ostrade-automation-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Activity exported as CSV");
  };

  const loading = signalsQ.isPending || accountsQ.isPending || schedulesQ.isPending;

  return (
    <main className="page-dash-signal-automation" aria-labelledby="os-auto-title">
      <PageHero
        icon={Workflow}
        art="automation"
        kicker="T-5 · AUTOMATION"
        titleId="os-auto-title"
        title={<>Automation <span className="os-hero-accent">&amp;</span> Scheduling</>}
        lead="Schedule saved signals, set rules for every trade, and pause, stop or resume the workspace — paper trades simulate locally."
        meta={
          <>
            <span className="os-hero-pill"><ShieldCheck size={13} aria-hidden /> YOUR ACTIONS · NOT BROKER SETTINGS</span>
            <span><CalendarDays size={13} aria-hidden /> EAT (UTC+3)</span>
            <span><CircleCheck size={13} aria-hidden /> Paper-first preview</span>
          </>
        }
        actions={
          <>
            <Link to="/dashboard/scheduler" className="btn os-hero-btn"><CalendarClock size={15} aria-hidden /> Trade Scheduler (T-6)</Link>
            <button
              type="button"
              className="btn os-hero-btn os-hero-primary"
              onClick={() => { setActiveTab("signals"); setEditor({ ...blankEditor, symbol: signals[0]?.order.symbol ?? "XAUUSD" }); setEditorError(""); }}
            >
              <Zap size={15} aria-hidden /> New signal
            </button>
          </>
        }
      />

      <div className="os-auto-section os-auto-connect" aria-label="How this page relates to the others">
          <Link to="/dashboard/signals" className="os-auto-connect-item">
            <span className="os-mono">T-4</span>
            <strong>Signal Desk</strong>
            <small>Where incoming signals arrive</small>
          </Link>
          <span className="os-auto-connect-item is-current" aria-current="page">
            <span className="os-mono">T-5</span>
            <strong>Automation</strong>
            <small>You are here — schedule &amp; rules</small>
          </span>
          <Link to="/dashboard/scheduler" className="os-auto-connect-item">
            <span className="os-mono">T-6</span>
            <strong>Trade Scheduler</strong>
            <small>Where scheduled slots run</small>
          </Link>
          <Link to="/dashboard/records" className="os-auto-connect-item">
            <span className="os-mono">T-8</span>
            <strong>Records</strong>
            <small>Where every action is booked</small>
          </Link>
        </div>

      {recordNote && (
        <div className="os-auto-section os-auto-note" role="status">
          <ListChecks size={15} aria-hidden />
          <span>{recordNote}</span>
        </div>
      )}

      {loading ? (
        <div className="d-grid gap-3" aria-busy="true">
          <Skel h={120} />
          <Skel h={260} />
        </div>
      ) : signalsQ.isError || accountsQ.isError ? (
        <QueryError
          title="Could not load automation data"
          onRetry={() => {
            void qc.invalidateQueries({ queryKey: ["signals"] });
            void qc.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      ) : (
        <>
          <div className="os-auto-tabs" role="tablist" aria-label="Automation sections">
            {automationTabs.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                id={`auto-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={`auto-panel-${id}`}
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => setActiveTab(id)}
                onKeyDown={(event) => {
                  const last = automationTabs.length - 1;
                  const nextIndex =
                    event.key === "ArrowRight"
                      ? index === last ? 0 : index + 1
                      : event.key === "ArrowLeft"
                        ? index === 0 ? last : index - 1
                        : event.key === "Home" ? 0
                        : event.key === "End" ? last
                        : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  const next = automationTabs[nextIndex].id;
                  setActiveTab(next);
                  document.getElementById(`auto-tab-${next}`)?.focus();
                }}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab 1 · My signals ─────────────────────────── */}
          <TabPanel tab="signals" activeTab={activeTab}>
            <div className="os-auto-section">
              <Head
                eyebrow="MY SIGNALS"
                title="Pick a saved signal, fine-tune it, schedule it"
                sub="Signals come from Signal Desk (T-4). Edit the lots, entry, amount figures, stop loss and take profit, then save it or schedule it for later."
              />
              {banner && <Banner outcome={banner} onClose={() => setBanner(null)} />}
              <div className="row g-3">
                <div className="col-12 col-lg-7">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>{signals.length} saved signals</strong>
                    <button
                      type="button"
                      className="os-btn os-btn-primary os-btn-sm"
                      onClick={() => {
                        setEditor({ ...blankEditor, symbol: signals[0]?.order.symbol ?? "XAUUSD" });
                        setEditorError("");
                      }}
                    >
                      <Plus size={14} aria-hidden /> New signal
                    </button>
                  </div>
                  <div className="os-auto-signal-list">
                    {signals.map((s) => {
                      const schedulable = s.status === "Parsed" || s.status === "Staged";
                      return (
                        <article key={s.id} className="os-auto-signal-row">
                          <div className="os-auto-signal-main">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong className="os-mono">{s.order.symbol}</strong>
                              <span className={`os-auto-side ${s.order.side === "BUY" ? "is-buy" : "is-sell"}`}>
                                {s.order.side}
                              </span>
                              <span className={`os-auto-chip ${statusChipClass[s.status] ?? "is-mute"}`}>
                                {s.status}
                              </span>
                            </div>
                            <span className="os-mono os-auto-figures">
                              {s.order.size} lots @ {s.order.entry} · SL {s.order.sl} · TP {s.order.targets[0] ?? "—"}
                            </span>
                            <span className="os-auto-meta">
                              {s.id} · {s.feed} · {eatTime(s.time)}
                            </span>
                            {s.notes.length > 0 && (
                              <span className="os-auto-meta os-auto-note-line">{s.notes[s.notes.length - 1]}</span>
                            )}
                          </div>
                          <div className="os-auto-signal-actions">
                            <button type="button" className="os-soft-button" onClick={() => openEdit(s)}>
                              <Pencil size={13} aria-hidden /> Edit
                            </button>
                            <button
                              type="button"
                              className="os-soft-button"
                              disabled={!schedulable}
                              title={schedulable ? "Schedule this signal for later" : `Signals in ${s.status} cannot be scheduled`}
                              onClick={() => {
                                setScheduleFor(s);
                                setScheduleAt(deskScheduleSlot(30));
                              }}
                            >
                              <CalendarClock size={13} aria-hidden /> Schedule
                            </button>
                            <button
                              type="button"
                              className="os-soft-button is-danger"
                              aria-label={`Discard ${s.id}`}
                              onClick={() => discard(s)}
                            >
                              <Trash2 size={13} aria-hidden />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="col-12 col-lg-5">
                  {editor && (
                    <div className="os-auto-card">
                      <Head
                        eyebrow={editor.id ? "EDIT SIGNAL" : "NEW SIGNAL"}
                        title={editor.id ? `Editing ${editor.id}` : "New signal"}
                        sub="Every figure is yours to set: instrument, direction, entry, lots, stop loss, take profit."
                      />
                      <form
                        className="os-auto-editor"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEditor(false);
                        }}
                      >
                        <label>
                          <span>Instrument</span>
                          <select value={editor.symbol} onChange={(e) => setEditor({ ...editor, symbol: e.target.value })}>
                            {marketSymbols.map((s) => (
                              <option key={s.canonical} value={s.canonical}>
                                {s.canonical} · {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="os-auto-seg" role="group" aria-label="Direction">
                          {(["BUY", "SELL"] as const).map((side) => (
                            <button
                              key={side}
                              type="button"
                              className={editor.side === side ? "is-on" : ""}
                              aria-pressed={editor.side === side}
                              onClick={() => setEditor({ ...editor, side })}
                            >
                              {side}
                            </button>
                          ))}
                        </div>
                        <label>
                          <span>Entry price</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editor.entry}
                            onChange={(e) => setEditor({ ...editor, entry: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          <span>Lots</span>
                          <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={editor.size}
                            onChange={(e) => setEditor({ ...editor, size: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          <span>Stop loss</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editor.sl}
                            onChange={(e) => setEditor({ ...editor, sl: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          <span>Take profit</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editor.tp}
                            onChange={(e) => setEditor({ ...editor, tp: e.target.value })}
                            required
                          />
                        </label>
                        {editorError && <p className="os-auto-error" role="alert">{editorError}</p>}
                        <div className="d-flex flex-wrap gap-2">
                          <button type="submit" className="os-btn os-btn-primary os-btn-sm">
                            <Zap size={14} aria-hidden /> Save signal
                          </button>
                          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => saveEditor(true)}>
                            <CalendarClock size={14} aria-hidden /> Save &amp; schedule later
                          </button>
                          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => setEditor(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {scheduleFor && (
                    <div className="os-auto-card">
                      <Head
                        eyebrow="SCHEDULE FOR LATER"
                        title={`Schedule ${scheduleFor.id}`}
                        sub={`${scheduleFor.order.side} ${scheduleFor.order.size} ${scheduleFor.order.symbol} — runs via Trade Scheduler (T-6). Your trading rules are checked at booking.`}
                      />
                      <form
                        className="os-auto-editor"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitSchedule();
                        }}
                      >
                        <label>
                          <span>Run at (EAT)</span>
                          <input
                            type="datetime-local"
                            value={scheduleAt}
                            min={deskScheduleSlot(1)}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            required
                          />
                        </label>
                        <label>
                          <span>Account</span>
                          <select
                            value={scheduleAccountId || paperAccounts[0]?.id || ""}
                            onChange={(e) => setScheduleAccountId(e.target.value)}
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label} ({a.brokerName})
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="os-auto-hint">
                          Paper schedules simulate locally and are managed in Trade Scheduler (T-6).
                        </p>
                        <div className="d-flex flex-wrap gap-2">
                          <button type="submit" className="os-btn os-btn-primary os-btn-sm">
                            <CalendarClock size={14} aria-hidden /> Schedule it
                          </button>
                          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => setScheduleFor(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="os-auto-card os-auto-sched-card">
                    <Head
                      eyebrow="PENDING"
                      title={`Scheduled orders (${pendingSchedules.length})`}
                      sub={schedulesQ.data ? `${schedulesQ.data.usedSlots}/${schedulesQ.data.maxSlots} scheduler slots in use.` : undefined}
                    />
                    {pendingSchedules.length === 0 ? (
                      <p className="os-auto-empty">Nothing queued. Schedule a signal and it shows up here.</p>
                    ) : (
                      <ul className="os-auto-mini-list">
                        {pendingSchedules.slice(0, 6).map((s) => (
                          <li key={s.id}>
                            <span className="os-mono">{s.symbol}</span>
                            <span>{s.side} {s.lots} lots</span>
                            <span>{s.timeEat}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link to="/dashboard/scheduler" className="os-auto-link">
                      Open Trade Scheduler (T-6) <ArrowRight size={13} aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* ── Tab 2 · Trading rules ──────────────────────── */}
          <TabPanel tab="rules" activeTab={activeTab}>
            <div className="os-auto-section">
              <Head
                eyebrow="TRADING RULES · ALL TRADES"
                title="Automations that affect every trade"
                sub="These are your actions, not broker settings: caps on size and amount, a daily automation cap, an auto-pause breaker, and the master pause / stop / resume control."
              />
              {banner && <Banner outcome={banner} onClose={() => setBanner(null)} />}
              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <div className="os-auto-card">
                    <Head
                      eyebrow="PER-TRADE & DAILY LIMITS"
                      title="Global caps"
                      sub="Checked every time Automation books a scheduled signal."
                    />
                    <form
                      className="os-auto-editor"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveRules();
                      }}
                    >
                      {(Object.keys(tradingRuleBounds) as (keyof TradingRules)[]).map((key) => {
                        const [min, max] = tradingRuleBounds[key];
                        const unit = key === "maxAmountPerTrade" ? "USD margin" : key === "maxLotsPerTrade" ? "lots" : key === "maxAutomatedPerDay" ? "trades/day" : "% daily loss";
                        return (
                          <label key={key}>
                            <span>
                              {ruleLabels[key]} <small className="text-secondary">({unit})</small>
                            </span>
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step={key === "maxLotsPerTrade" ? "0.01" : "1"}
                              value={rulesForm[key]}
                              onChange={(e) => setRulesForm({ ...rulesForm, [key]: e.target.value })}
                              required
                            />
                          </label>
                        );
                      })}
                      {rulesError && <p className="os-auto-error" role="alert">{rulesError}</p>}
                      <button type="submit" className="os-btn os-btn-primary os-btn-sm">
                        <SlidersHorizontal size={14} aria-hidden /> Save rules
                      </button>
                    </form>
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="os-auto-card">
                    <Head
                      eyebrow="MASTER CONTROL"
                      title="Pause, stop or resume everything"
                      sub="Pause halts rules and scheduled slots. Stop-all also closes Paper positions at market and books it in Records (T-8)."
                    />
                    <p className="os-auto-state">
                      Workspace state:{" "}
                      <span className={`os-auto-state-pill is-${killSwitch}`}>
                        {killSwitch === "armed" ? "ARMED" : killSwitch === "paused" ? "PAUSED" : "STOPPED"}
                      </span>
                    </p>
                    <div className="os-auto-controls">
                      <button type="button" className="os-auto-control is-resume" disabled={killSwitch === "armed"} onClick={() => runControl("armed")}>
                        <Play size={15} aria-hidden />
                        <strong>Resume</strong>
                        <small>Re-arm automation and restore scheduled slots.</small>
                      </button>
                      <button type="button" className="os-auto-control is-pause" disabled={killSwitch !== "armed"} onClick={() => runControl("paused")}>
                        <Hourglass size={15} aria-hidden />
                        <strong>Pause</strong>
                        <small>Stop new automated trades; keep positions open.</small>
                      </button>
                      <button type="button" className="os-auto-control is-stop" disabled={killSwitch === "flattened"} onClick={() => setConfirmStop(true)}>
                        <Square size={15} aria-hidden />
                        <strong>Stop all</strong>
                        <small>Pause + close every Paper position now.</small>
                      </button>
                    </div>
                    {confirmStop && (
                      <div className="os-auto-confirm" role="alertdialog" aria-label="Confirm stop-all">
                        <p>
                          <strong>Stop everything?</strong> This closes all Paper positions at market and logs the
                          closures to Records. Broker-side positions are never touched.
                        </p>
                        <div className="d-flex gap-2">
                          <button type="button" className="os-btn os-btn-dark os-btn-sm" onClick={() => runControl("flattened")}>
                            Yes, stop everything
                          </button>
                          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => setConfirmStop(false)}>
                            Keep trading
                          </button>
                        </div>
                      </div>
                    )}
                    {controlError && <p className="os-auto-error" role="alert">{controlError}</p>}
                    <p className="os-auto-hint">
                      The same controls live in the header kill switch, so you can always pause from any page.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* ── Tab 3 · Activity ───────────────────────────── */}
          <TabPanel tab="activity" activeTab={activeTab}>
            <div className="os-auto-section">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <Head
                  eyebrow="ACTIVITY"
                  title="What automation did"
                  sub="Schedules, saved signals, rule changes and workspace controls. Fills and closures land in Records (T-8)."
                />
                <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={exportActivity}>
                  <Download size={14} aria-hidden /> Export CSV
                </button>
              </div>
              {activityQ.isError ? (
                <QueryError title="Could not load activity" onRetry={() => refresh(["automation-activity"])} />
              ) : activityQ.isPending ? (
                <Skel h={220} />
              ) : (
                <ul className="os-auto-events">
                  {activityQ.data.map((e) => (
                    <li key={e.id}>
                      <span className={`os-auto-chip ${kindChipClass[e.kind]}`}>{e.kind}</span>
                      <div>
                        <strong>{e.title}</strong>
                        <small>{e.detail}</small>
                      </div>
                      <span className="os-auto-when">{eatTime(e.at)}</span>
                      {e.ref && <span className="os-mono os-auto-ref">{e.ref}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabPanel>
        </>
      )}
    </main>
  );
}
