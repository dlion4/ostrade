import { useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, BookOpen, Check, FlaskConical, Gauge, Info, Loader2, Plus, Radio, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert, Zap } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import type { TradingAccount } from "@/services/dashboard";
import { usePageStyle } from "@/hooks/usePageStyle";
import { RulesTable } from "@/components/automation/RulesTable";
import { RuleBuilder } from "@/components/automation/RuleBuilder";
import { ConditionLibraryPanel } from "@/components/automation/ConditionLibrary";
import { PreviewPanel } from "@/components/automation/PreviewPanel";
import { DryRunPanel } from "@/components/automation/DryRunPanel";
import { AuditLog } from "@/components/automation/AuditLog";
import { SafetyPanel } from "@/components/automation/SafetyPanel";
import { AutoDialog, InlineNotice, SparkBars } from "@/components/automation/AutomationUI";
import {
  defaultRuleDraft,
  duplicateAutomationRule,
  getAutomationAudit,
  getAutomationPageData,
  getAutomationStats,
  previewDraft,
  ruleToDraft,
  runDryRun,
  saveAutomationRule,
  setAutomationRuleEnabled,
  deleteAutomationRule,
  pauseAllAutomation,
  type AutomationAudit,
  type DryRunReport,
  type RuleDraft,
  type SignalRule,
} from "@/services/automation";
import { getAccounts } from "@/services/dashboard";
import { marketSymbols } from "@/data/markets";
import css from "@/styles/pages/dash-signal-automation.css?inline";

type Confirmation =
  | { kind: "activate"; draft: RuleDraft; rule?: SignalRule }
  | { kind: "delete"; rule: SignalRule }
  | { kind: "pause-all" };

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

function newDraft(accounts: TradingAccount[]): RuleDraft {
  const base = defaultRuleDraft(accounts);
  const paper = accounts.find((account) => account.environment === "paper");
  return { ...base, accountIds: paper ? [paper.id] : accounts[0]?.id ? [accounts[0].id] : [], status: "draft", id: undefined, lastDryRunAt: undefined, lastDryRunSummary: undefined };
}

function GuideDialog({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  return <AutoDialog title="The path from signal to automation" overline="AUTOMATION HANDBOOK" description="Rules only execute what you explicitly approve. A dry run is the bridge from an idea to an active rule." onClose={onClose} wide footer={<><span><ShieldCheck size={14}/> Paper-first in this preview</span><button type="button" className="os-auto-primary" onClick={onStart}>Create a rule <ArrowRight size={14}/></button></>}>
    <div className="os-auto-guide">{[["1", "Choose a source", "Approve the channels, webhooks, or providers that can trigger this rule."], ["2", "Describe the signal", "Compose AND conditions for instrument, side, stop, confidence, spread, and session."], ["3", "Map the action", "Pick target accounts and decide how the size and exits are converted."], ["4", "Bound the risk", "Add hourly caps, a position contribution limit, a dedupe window, and a loss breaker."], ["5", "Run a dry run", "Replay stored signals. A dry run creates no orders and changes no positions."], ["6", "Activate deliberately", "Confirm activation in the dialog. The audit log records the operator action."]].map(([number, title, text]) => <div key={number}><span>{number}</span><section><h3>{title}</h3><p>{text}</p></section></div>)}</div>
    <InlineNotice>The engine never connects to a real broker in this phase. Active rules evaluate against the local desk snapshot, and Paper fills remain simulated.</InlineNotice>
  </AutoDialog>;
}

export function DashAutomationPage() {
  const { recordSource } = useSearch({ from: "/dashboard/automation" });
  usePageStyle("dash-signal-automation", css);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { killSwitch, globalMode } = useDashboardContext();
  const [draft, setDraft] = useState<RuleDraft>(() => newDraft([]));
  const [initialised, setInitialised] = useState(false);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [dryRunDays, setDryRunDays] = useState(7);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [builderSession, setBuilderSession] = useState(0);
  const [dryRunning, setDryRunning] = useState(false);
  const [actionError, setActionError] = useState("");

  const setup = useQuery({ queryKey: ["automation-page"], queryFn: getAutomationPageData });
  const audit = useQuery({ queryKey: ["automation-audit"], queryFn: getAutomationAudit });
  const stats = useQuery({ queryKey: ["automation-stats"], queryFn: () => getAutomationStats() });
  const accountQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });

  const accounts = useMemo(() => (setup.data?.accounts ?? accountQ.data ?? []).filter((account) => account.connected || account.environment === "live-ready"), [setup.data?.accounts, accountQ.data]);
  const halted = killSwitch !== "armed";
  const activeRules = (setup.data?.rules ?? []).filter((rule) => rule.enabled).length;
  const preview = useMemo(() => setup.data ? previewDraft(draft, setup.data.samples.slice(0, 20), accounts, setup.data.openPositions, halted) : [], [setup.data, draft, accounts, halted]);
  const prerequisiteCount = Number(draft.sources.length > 0) + Number(draft.accountIds.length > 0) + Number(draft.symbols.length > 0) + Number(!halted) + Number(!!report || !!draft.lastDryRunAt);
  const configTargetsBroker = draft.accountIds.some((id) => accounts.find((account) => account.id === id)?.environment !== "paper");

  useEffect(() => {
    const old = document.title;
    document.title = "Automation engine | OStrade";
    return () => { document.title = old; };
  }, []);

  useEffect(() => {
    if (!setup.data || initialised) return;
    const linked = setup.data.rules.find((rule) => rule.id === recordSource);
    const source = linked ?? setup.data.rules.find((rule) => rule.enabled) ?? setup.data.rules[0];
    const base = source ? ruleToDraft(source, accounts) : newDraft(accounts);
    setDraft(base);
    setInitialised(true);
    if (linked) scrollTo("builder");
  }, [setup.data, accounts, initialised, recordSource]);

  const refresh = useCallback(() => {
    for (const key of ["automation-page", "automation-audit", "automation-stats", "signal-rules", "accounts"]) void queryClient.invalidateQueries({ queryKey: [key] });
  }, [queryClient]);

  const saveDraft = async (activate: boolean): Promise<boolean> => {
    setActionError("");
    setSaving(true);
    try {
      const saved = await saveAutomationRule(draft, activate);
      await queryClient.invalidateQueries({ queryKey: ["automation-page"] });
      setDraft(ruleToDraft(saved, accounts));
      refresh();
      toast(activate ? `${saved.name} is active in the local engine` : `${saved.name} saved as a draft`);
      setSaving(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the rule.";
      setActionError(message);
      toast(message);
      setSaving(false);
      return false;
    }
  };

  const openActivation = (nextDraft: RuleDraft) => {
    if (halted) { toast("Re-arm the kill switch before activating a rule"); return; }
    setAcknowledged(false);
    setActionError("");
    setDraft(nextDraft);
    setConfirmation({ kind: "activate", draft: nextDraft });
    scrollTo("automation-confirmation");
  };

  const runDryRunFor = async (target: RuleDraft, days = dryRunDays) => {
    setActionError("");
    setDryRunning(true);
    try {
      const next = await runDryRun(target, days, Boolean(target.id));
      setReport(next);
      setDryRunning(false);
      void queryClient.invalidateQueries({ queryKey: ["automation-audit"] });
      void queryClient.invalidateQueries({ queryKey: ["automation-page"] });
      refresh();
      toast(`${days}-day dry run complete: ${next.executed} would execute`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "The dry run could not complete.");
      setDryRunning(false);
    }
  };

  const beginNew = () => {
    setDraft(newDraft(accounts));
    setBuilderSession((value) => value + 1);
    setReport(null);
    setActionError("");
    scrollTo("builder");
  };

  const editRule = (rule: SignalRule) => {
    setDraft(ruleToDraft(rule, accounts));
    setBuilderSession((value) => value + 1);
    setReport(null);
    setActionError("");
    scrollTo("builder");
  };

  const handleToggle = async (rule: SignalRule) => {
    setBusyRuleId(rule.id);
    try {
      if (rule.enabled) {
        await setAutomationRuleEnabled(rule.id, false);
        refresh();
        toast(`${rule.name} paused`);
      } else {
        openActivation(ruleToDraft(rule, accounts));
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not change the rule state");
    } finally {
      setBusyRuleId(null);
    }
  };

  const duplicateRule = async (rule: SignalRule) => {
    setBusyRuleId(rule.id);
    try {
      const copy = await duplicateAutomationRule(rule, accounts);
      await queryClient.invalidateQueries({ queryKey: ["automation-page"] });
      refresh();
      setDraft(ruleToDraft(copy, accounts));
      toast(`${rule.name} duplicated as a draft`);
      scrollTo("builder");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not duplicate the rule");
    } finally { setBusyRuleId(null); }
  };

  const dryRunRule = async (rule: SignalRule) => {
    const next = ruleToDraft(rule, accounts);
    setDraft(next);
    setReport(null);
    setDryRunDays(7);
    scrollTo("dry-run");
    await runDryRunFor(next, 7);
  };

  const confirmDelete = (rule: SignalRule) => { setAcknowledged(false); setConfirmation({ kind: "delete", rule }); };
  const confirmAction = async () => {
    if (!confirmation) return;
    setActionError("");
    try {
      if (confirmation.kind === "activate") {
        if (!acknowledged) return;
        if (halted) { setActionError("The global kill switch is engaged. Re-arm it before activating automation."); return; }
        const saved = await saveDraft(true);
        if (!saved) return;
      }
      if (confirmation.kind === "delete") {
        await deleteAutomationRule(confirmation.rule);
        setConfirmation(null);
        void queryClient.invalidateQueries({ queryKey: ["automation-page"] });
        refresh();
        toast(`${confirmation.rule.name} deleted; its audit trail remains`);
        return;
      }
      if (confirmation.kind === "pause-all") {
        setPausing(true);
        const result = await pauseAllAutomation(setup.data?.rules ?? []);
        refresh();
        toast(`${result.count} active rule${result.count === 1 ? "" : "s"} paused`);
      }
      setConfirmation(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action could not complete.";
      setActionError(message);
      toast(message);
    } finally {
      setPausing(false);
    }
  };

  if (setup.isError || audit.isError || stats.isError) return <main className="page-dash-signal-automation os-auto-page"><QueryError title="The automation engine could not load" onRetry={() => { void setup.refetch(); void audit.refetch(); void stats.refetch(); }}/></main>;
  if (setup.isPending || audit.isPending || stats.isPending) return <main className="page-dash-signal-automation os-auto-page" aria-busy="true"><div className="os-auto-skeleton"><span/><span/><span/><span/></div></main>;

  const rules = setup.data.rules;
  const audits: AutomationAudit[] = audit.data ?? [];
  const kpi = stats.data!;
  const lastDecision = audits.find((event) => event.decision !== "OPERATOR") ?? audits[0];
  const guardrailPass = !halted && draft.requireSl && draft.accountIds.length > 0 && draft.sources.length > 0;

  return <main className="page-dash-signal-automation os-auto-page" aria-labelledby="auto-title">
    <section className="os-auto-section os-auto-overview" aria-labelledby="auto-title">
      <div className="os-auto-masthead">
        <div>
          <div className="os-auto-workspace-label"><i/> AUTOMATION WORKSPACE <span>LOCAL ENGINE PREVIEW</span></div>
          <h1 id="auto-title">Automation<span className="os-auto-title-period">.</span></h1>
          <p>Turn the Signal Desk from manual to autonomous — with hard risk guards and a dry-run simulator so you trust a rule before it trades.</p>
        </div>
        <div className="os-auto-mast-actions">
          <button type="button" className="os-auto-secondary" onClick={() => setGuideOpen(true)}><BookOpen size={15}/> Desk guide</button>
          <button type="button" className="os-auto-primary" onClick={beginNew}><Plus size={15}/> New rule</button>
        </div>
      </div>
      <div className="os-auto-engine-strip"><div className="os-auto-engine-state"><span className={`os-auto-listen ${!halted && activeRules ? "is-on" : ""}`}/><b>{halted ? "Engine held by kill switch" : activeRules ? "Engine listening locally" : "No rule is listening"}</b><span>{halted ? "Rules and schedules are paused. Manual trade checks still apply." : "Snapshot-only feed · no live broker connections"}</span></div><div className="os-auto-engine-facts"><span><Activity size={13}/>{activeRules} active</span><span><ShieldCheck size={13}/>{kpi.blockedToday} blocked today</span><span><FlaskConical size={13}/>dry-run ready</span><span className="os-mono">{globalMode === "paper" ? "PAPER" : "LIVE PREVIEW"}</span></div></div>
      <div className="os-auto-kpis">
        <article className="os-auto-kpi"><div><span>Active rules</span><i className="os-auto-kpi-icon is-orange"><Zap size={16}/></i></div><b><CountUp value={kpi.activeRules}/><small> / {kpi.totalRules}</small></b><p>of 30 rule slots in this workspace</p><div className="os-auto-kpi-foot"><span className="os-auto-listen is-on"/> {kpi.activeRules ? "Listening for parsed signals" : "All rules paused"}</div></article>
        <article className="os-auto-kpi"><div><span>Signals processed today</span><i className="os-auto-kpi-icon is-blue"><Radio size={16}/></i></div><b><CountUp value={kpi.processedToday}/></b><p>evaluations across active and paused rules</p><div className="os-auto-kpi-foot"><Check size={12}/> Audit entry for every decision</div></article>
        <article className="os-auto-kpi"><div><span>Auto-executed today</span><i className="os-auto-kpi-icon is-green"><Sparkles size={16}/></i></div><b><CountUp value={kpi.executedToday}/></b><p>qualifying signals routed with a receipt</p><div className="os-auto-kpi-foot"><span className="os-auto-sim-label">SIMULATED</span> Paper legs · broker previews only</div></article>
        <article className="os-auto-kpi"><div><span>Blocked by guards today</span><i className="os-auto-kpi-icon is-red"><ShieldAlert size={16}/></i></div><b><CountUp value={kpi.blockedToday}/></b><p>held before an order could be created</p><div className="os-auto-kpi-foot"><SparkBars values={kpi.trend} tone="red"/><span>7-day pattern</span></div></article>
      </div>
      {lastDecision && <div className="os-auto-last-decision"><span className={`os-auto-listen ${lastDecision.decision === "EXECUTED" ? "is-on" : ""}`}/><span>Latest decision</span><b>{lastDecision.ruleName}</b><span>{lastDecision.decision.toLowerCase()} · {lastDecision.reason}</span><button type="button" className="os-auto-text-button" onClick={() => scrollTo("audit")}>Open audit <ArrowRight size={12}/></button></div>}
    </section>

    <RulesTable rules={rules} accounts={accounts} busyId={busyRuleId} onEdit={editRule} onDuplicate={(rule) => void duplicateRule(rule)} onDryRun={(rule) => void dryRunRule(rule)} onDelete={confirmDelete} onToggle={(rule) => void handleToggle(rule)} onCreate={beginNew}/>

    <RuleBuilder key={builderSession} draft={draft} setDraft={(next) => { setDraft(next); setActionError(""); }} accounts={accounts} markets={marketSymbols} samples={setup.data.samples} openPositions={setup.data.openPositions} halted={halted} editing={Boolean(draft.id)} saving={saving} dryRunning={dryRunning} onSave={(activate) => activate ? openActivation(draft) : void saveDraft(false)} onRunDryRun={() => void runDryRunFor(draft)} onCancel={beginNew}/>

    <PreviewPanel draft={draft} preview={preview} onOpenBuilder={() => scrollTo("builder")}/>

    <ConditionLibraryPanel conditions={setup.data.conditions} draft={draft} onPatch={(patch) => { setDraft((current) => ({ ...current, ...patch })); }} onOpenBuilder={() => scrollTo("builder")}/>

    <DryRunPanel draft={draft} report={report} days={dryRunDays} setDays={(days) => { setDryRunDays(days); setReport(null); }} running={dryRunning} onRun={() => void runDryRunFor(draft, dryRunDays)} onPromote={() => openActivation(draft)}/>

    <AuditLog events={audits}/>

    <SafetyPanel activeCount={activeRules} draft={draft} halted={halted} pausing={pausing} onPauseAll={() => { setAcknowledged(false); setConfirmation({ kind: "pause-all" }); }}/>

    <section className="os-auto-section os-auto-readiness" aria-labelledby="auto-ready-heading">
      <div className="os-auto-readiness-copy"><span className="os-auto-eyebrow">09 · GO-LIVE READINESS</span><h2 id="auto-ready-heading">A rule is ready when the evidence says so.</h2><p>The engine will not activate a rule that points at an unavailable account or a missing instrument. This checklist is evaluated from your current draft.</p><div className="os-auto-readiness-actions"><button type="button" className="os-auto-secondary" onClick={() => void runDryRunFor(draft)}><FlaskConical size={14}/> Run the dry run</button><button type="button" className="os-auto-primary" disabled={halted || !draft.accountIds.length} onClick={() => openActivation(draft)}>Review &amp; activate <ArrowRight size={14}/></button></div></div>
      <div className="os-auto-check-list">{[
        { icon: Radio, label: "Trigger approved", done: draft.sources.length > 0, detail: `${draft.sources.length} source${draft.sources.length === 1 ? "" : "s"} selected` },
        { icon: Gauge, label: "Risk is bounded", done: draft.requireSl && draft.dailyLossPct > 0 && draft.maxTradesHour > 0, detail: draft.requireSl ? `Mandatory SL · ${draft.dailyLossPct}% breaker · ${draft.maxTradesHour}/hr` : "Add a stop-loss condition" },
        { icon: Check, label: "Targets are mapped", done: draft.accountIds.length > 0 && draft.symbols.length > 0, detail: draft.accountIds.length && draft.symbols.length ? `${draft.accountIds.length} account${draft.accountIds.length === 1 ? "" : "s"} · ${draft.symbols.length} instrument${draft.symbols.length === 1 ? "" : "s"}` : "Choose account and instrument" },
        { icon: FlaskConical, label: "Dry run reviewed", done: Boolean(report || draft.lastDryRunAt), detail: report ? `${report.runId} · ${report.evaluated} signals` : draft.lastDryRunAt ? `${draft.lastDryRunAt} · ${draft.lastDryRunSummary}` : "Not run yet — recommended before activation" },
        { icon: ShieldCheck, label: "Kill switch respects", done: !halted, detail: halted ? "Re-arm the workspace before activation" : "Global kill switch is armed and above this rule" },
        { icon: Info, label: "Execution boundary", done: true, detail: configTargetsBroker ? "Broker legs stay preview-only; Paper fills simulate locally" : "Paper-only targets — fully simulated locally" },
      ].map((item) => { const Icon = item.icon; return <div key={item.label} className={`os-auto-check ${item.done ? "is-done" : "is-pending"}`}><span className="os-auto-check-icon">{item.done ? <Check size={14}/> : <Icon size={14}/>}</span><div><b>{item.label}</b><small>{item.detail}</small></div></div>; })}<div className="os-auto-check-summary"><span>{prerequisiteCount} of 5 core pre-flight checks satisfied</span><span className="os-auto-muted">{guardrailPass ? "No hard stop is blocking activation." : "Activation needs an armed switch, a source, and a target account."}</span></div></div>
    </section>

    <footer className="os-auto-footer"><span><ShieldCheck size={14}/> Local automation workspace</span><span>No network calls · Paper fills only · Broker execution requires the backend</span><Link to="/dashboard/risk" className="os-auto-text-button">Risk &amp; guardrails (T-14) <ArrowRight size={12}/></Link></footer>

    {guideOpen && <GuideDialog onClose={() => setGuideOpen(false)} onStart={() => { setGuideOpen(false); beginNew(); }}/>}
    {confirmation && <AutoDialog title={confirmation.kind === "activate" ? "Activate this rule?" : confirmation.kind === "delete" ? "Delete this rule?" : "Pause every active rule?"} overline={confirmation.kind === "activate" ? "DELIBERATE ACTIVATION" : confirmation.kind === "delete" ? "DESTRUCTIVE ACTION" : "ENGINE WIDE PAUSE"} description={confirmation.kind === "activate" ? "Activation enables local evaluation for this rule. It does not open a broker connection." : confirmation.kind === "delete" ? "The configuration will be removed. The audit trail stays for accountability." : "All active rules stop evaluating until you re-enable them. Open positions are untouched."} onClose={() => { if (!pausing && !saving) { setConfirmation(null); setActionError(""); } }} locked={pausing} footer={<><span><ShieldCheck size={14}/> Every operator action is audited</span><div className="os-auto-dialog-actions"><button type="button" className="os-auto-secondary" onClick={() => { setConfirmation(null); setActionError(""); }} disabled={pausing}>Cancel</button><button type="button" className="os-auto-primary" disabled={(confirmation.kind === "activate" && (!acknowledged || saving)) || pausing || (confirmation.kind === "activate" && halted)} onClick={() => void confirmAction()}>{pausing || (confirmation.kind === "activate" && saving) ? <Loader2 size={14} className="os-spin"/> : confirmation.kind === "delete" ? "Delete rule" : confirmation.kind === "pause-all" ? "Pause all rules" : "Activate rule"}</button></div></>}>
      <div className="os-auto-confirm-body">
        {confirmation.kind === "activate" && <><div className="os-auto-confirm-summary"><span>{confirmation.draft.name || "Untitled draft"}</span><b>{confirmation.draft.symbols.join(" / ") || "Any instrument"} → {confirmation.draft.accountIds.length} account{confirmation.draft.accountIds.length === 1 ? "" : "s"}</b><small>{confirmation.draft.sources.length} source · {confirmation.draft.sizeMode} sizing · {confirmation.draft.maxTradesHour}/hr cap</small></div>{configTargetsBroker && <InlineNotice tone="warn">One or more broker accounts are selected. Their order legs resolve to an execution preview, not a live order. No credentials are sent.</InlineNotice>}{!report && !confirmation.draft.lastDryRunAt && <InlineNotice tone="warn"><TriangleAlert size={15}/> No dry run is attached to this rule. Running the simulator first is strongly recommended.</InlineNotice>}<label className="os-auto-confirm-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand this activates local evaluation against a snapshot feed, and that Paper fills are simulated.</span></label>{halted && <InlineNotice tone="danger">The global kill switch is engaged. Re-arm it from the top bar before activating this rule.</InlineNotice>}</>}
        {confirmation.kind === "delete" && <div className="os-auto-confirm-summary"><span>Rule to remove</span><b>{confirmation.rule.name}</b><small>Audit history remains available after deletion.</small></div>}
        {confirmation.kind === "pause-all" && <div className="os-auto-confirm-summary"><span>Workspace</span><b>{activeRules} active rule{activeRules === 1 ? "" : "s"} will stop evaluating</b><small>Open positions and the kill-switch state are unchanged.</small></div>}
        {actionError && <InlineNotice tone="danger">{actionError}</InlineNotice>}
      </div>
    </AutoDialog>}
  </main>;
}
