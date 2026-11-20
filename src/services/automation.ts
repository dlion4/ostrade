import { isAutomationPaused } from "./dashboard";
import { mappedBrokerSymbol } from "./symbolMappings";
// T-5 service layer. Every read/write goes through these future REST-shaped calls.
import {
  automationConfigs,
  automationSources,
  conditionLibrary,
  defaultRuleDraft,
  initialAutomationAudit,
  kpiTrend,
  AUTOMATION_SNAPSHOT,
  sampleSignals,
  type AutomationAudit,
  type AutomationSignal,
  type AuditDecision,
} from "@/data/automation";
import {
  MAX_SIGNAL_RULES,
  getAccounts,
  getSignalRules,
  removeSignalRule,
  saveSignalRule,
  setSignalRuleEnabled,
  type RuleAutomationConfig,
  type RuleSourceKey,
  type RuleSession,
  type SignalRule,
  type TradingAccount,
  applyKillSwitch,
} from "@/services/dashboard";
import { marketSymbols } from "@/data/markets";
import {
  deskNow,
  discardSignal,
  eatTime,
  getSignals,
  savePlanSignal,
  scheduleDeskSignal,
  updateDeskSignal,
  type DeskSignal,
} from "./signalDesk";
import { latency } from "./_latency";
import type { SourceKey } from "@/data/signalDesk";

export { defaultRuleDraft, sampleSignals };
export type { AutomationAudit, AutomationSignal, AuditDecision, RuleAutomationConfig, RuleSession, RuleSourceKey, SignalRule, TradingAccount };

export interface RuleDraft extends Omit<RuleAutomationConfig, "updatedAt" | "lastDryRunAt" | "lastDryRunSummary"> {
  id?: string;
  copilot?: SignalRule["copilot"];
  name: string;
  updatedAt?: string;
  lastDryRunAt?: string;
  lastDryRunSummary?: string;
}

export interface PreviewOrder {
  accountId: string;
  accountLabel: string;
  broker: TradingAccount["broker"];
  environment: TradingAccount["environment"];
  symbol: string;
  size: number;
  unit: string;
  sl: number;
  tp: number;
  riskUsd: number;
  pnl: number;
  mode: "SIMULATED" | "PREVIEW" | "LIMIT";
}

export interface PreviewRow {
  signal: AutomationSignal;
  decision: "EXECUTE" | "SKIP";
  reason: string;
  orders: PreviewOrder[];
  guard: "PASS" | "BLOCKED" | "SKIPPED";
}

export interface DryRunAccount {
  accountId: string;
  label: string;
  broker: TradingAccount["broker"];
  environment: TradingAccount["environment"];
  trades: number;
  allocationUsd: number;
  pnl: number;
}

export interface DryRunReport {
  runId: string;
  ruleId?: string;
  ruleName: string;
  days: number;
  evaluated: number;
  executed: number;
  skipped: number;
  blocked: number;
  winCount: number;
  lossCount: number;
  hypotheticalPnl: number;
  allocation: number;
  accounts: DryRunAccount[];
  rows: PreviewRow[];
  runAt: string;
}

export interface AutomationKpi {
  activeRules: number;
  processedToday: number;
  executedToday: number;
  blockedToday: number;
  totalRules: number;
  trend: number[];
}

const sourceLabels: Record<SourceKey, string> = {
  paste: "Paste console",
  telegram: "Telegram",
  webhook: "TradingView webhook",
  email: "Email relay",
  csv: "Statement import",
  copyfactory: "CopyFactory provider",
};
export const automationSourceOptions = automationSources;
export const automationConditionLibrary = conditionLibrary;

const sourceToRule = (source: SourceKey): SignalRule["source"] =>
  source === "webhook" ? "TradingView" : source === "copyfactory" ? "CopyFactory" : source === "email" ? "Email" : "Telegram";
const sourceFromRule = (rule: SignalRule): SourceKey =>
  rule.source === "TradingView" ? "webhook" : rule.source === "CopyFactory" ? "copyfactory" : rule.source === "Email" ? "email" : "telegram";

function accountLabelList(accounts: TradingAccount[], ids: string[]) {
  return ids.map((id) => accounts.find((a) => a.id === id)?.label ?? id).join(" + ");
}

export function summarizeCondition(draft: RuleDraft): string {
  const parts: string[] = [];
  if (draft.symbols.length) parts.push(`${draft.symbols.join(" / ")}`);
  else parts.push("any instrument");
  if (draft.side !== "ANY") parts.push(draft.side);
  if (draft.requireSl) parts.push("SL required");
  if (draft.requireTp) parts.push("TP required");
  if (draft.minConfidence > 0) parts.push(`confidence ≥ ${draft.minConfidence}%`);
  if (draft.maxSpread > 0) parts.push(`spread ≤ ${draft.maxSpread} pts`);
  if (draft.session !== "any") parts.push(draft.session === "custom" ? `${draft.sessionStart}–${draft.sessionEnd} EAT` : `${draft.session} session`);
  if (draft.channels.length) parts.push(`channel: ${draft.channels.join(", ")}`);
  return parts.join(" · ");
}

export function summarizeAction(draft: RuleDraft, accounts: TradingAccount[]): string {
  const size = draft.sizeMode === "signal" ? "as signaled" : draft.sizeMode === "fixed" ? `${draft.sizeValue} units` : draft.sizeMode === "equity" ? `${draft.sizeValue}% equity` : `${draft.sizeValue}% risk`;
  const stop = draft.stopMode === "signal" ? "SL/TP from signal" : draft.stopMode === "scaled" ? `SL/TP scaled ×${(draft.stopScalePct / 100).toFixed(2)}` : draft.stopMode === "defaults" ? "guardrail default stops" : "no attached stop";
  return `${size} · ${stop} · ${accountLabelList(accounts, draft.accountIds)}`;
}

export function ruleToDraft(rule: SignalRule, accounts: TradingAccount[]): RuleDraft {
  const config = rule.automation ?? automationConfigs[rule.id] ?? (() => {
    const base = defaultRuleDraft(accounts);
    return { ...base, sources: [sourceFromRule(rule)] as RuleSourceKey[], symbols: [marketSymbols[0]?.canonical ?? "EURUSD"], accountIds: [rule.accountId] };
  })();
  return {
    ...config,
    id: rule.id,
    name: rule.name,
    description: config.description || rule.lastReason,
    sources: config.sources.length ? config.sources : [sourceFromRule(rule)],
    channels: config.channels ?? (rule.channel && rule.channel !== "All Channels" ? [rule.channel] : []),
    status: config.status ?? (rule.id === "rul-12" ? "draft" : rule.enabled ? "active" : "paused"),
    accountIds: config.accountIds?.length ? config.accountIds : [rule.accountId],
  };
}

export async function getAutomationRules(): Promise<SignalRule[]> {
  return getSignalRules();
}

export async function getAutomationPageData(): Promise<{
  rules: SignalRule[];
  accounts: TradingAccount[];
  openPositions: number;
  samples: AutomationSignal[];
  conditions: typeof conditionLibrary;
  sources: typeof automationSources;
  configFor: Record<string, RuleAutomationConfig>;
}> {
  const [rules, accounts] = await Promise.all([getSignalRules(), getAccounts()]);
  return latency({
    rules,
    accounts,
    openPositions: 0,
    samples: sampleSignals,
    conditions: conditionLibrary,
    sources: automationSources,
    configFor: automationConfigs,
  }, 300, 500);
}

export async function getAutomationAudit(): Promise<AutomationAudit[]> {
  return latency(auditStore, 300, 460);
}

export async function getAutomationStats(rules?: SignalRule[]): Promise<AutomationKpi> {
  const list = rules ?? (await getSignalRules());
  const todayStart = Date.UTC(2025, 2, 13, 21, 0);
  const today = auditStore.filter((event) => event.timestamp >= todayStart);
  return latency({
    activeRules: list.filter((r) => r.enabled).length,
    processedToday: today.filter((e) => e.decision !== "OPERATOR" && e.decision !== "DRY RUN").length,
    executedToday: today.filter((e) => e.decision === "EXECUTED").length,
    blockedToday: today.filter((e) => e.decision === "BLOCKED").length,
    totalRules: list.length,
    trend: kpiTrend,
  }, 260, 400);
}

let auditStore: AutomationAudit[] = structuredClone(initialAutomationAudit);
const nowLabel = () => "Today 16:42";
const uid = () => crypto.randomUUID();
function logEvent(event: Omit<AutomationAudit, "id" | "timestamp" | "timestampLabel">) {
  auditStore = [{ ...event, id: uid(), timestamp: Date.UTC(2025, 2, 14, 13, 42), timestampLabel: nowLabel() }, ...auditStore];
}

function assertDraft(draft: RuleDraft, accounts: TradingAccount[]) {
  if (draft.name.trim().length < 3) throw new Error("Give this rule a name of at least 3 characters.");
  if (!draft.sources.length) throw new Error("Choose at least one trigger source.");
  if (!draft.accountIds.length) throw new Error("Choose at least one target account.");
  const validAccounts = draft.accountIds.every((id) => accounts.some((a) => a.id === id));
  if (!validAccounts) throw new Error("One or more target accounts are no longer available.");
  if (draft.sizeMode !== "signal" && (!Number.isFinite(draft.sizeValue) || draft.sizeValue <= 0)) throw new Error("Enter a positive size value.");
  if (draft.sizeMode === "risk" && !draft.accountIds.length) throw new Error("Risk sizing needs a target account.");
  if (!Number.isFinite(draft.minConfidence) || draft.minConfidence < 0 || draft.minConfidence > 100) throw new Error("Confidence must be between 0 and 100.");
  if (!Number.isFinite(draft.maxSpread) || draft.maxSpread < 0) throw new Error("Spread ceiling cannot be negative.");
  if (!Number.isInteger(draft.maxTradesHour) || draft.maxTradesHour < 1 || draft.maxTradesHour > 60) throw new Error("Trades per hour must be a whole number from 1 to 60.");
  if (!Number.isInteger(draft.maxOpenPositions) || draft.maxOpenPositions < 1 || draft.maxOpenPositions > 50) throw new Error("Max open positions must be a whole number from 1 to 50.");
  if (!Number.isFinite(draft.dailyLossPct) || draft.dailyLossPct <= 0 || draft.dailyLossPct > 20) throw new Error("The daily-loss breaker must be above 0% and at most 20%.");
  if (!Number.isInteger(draft.dedupeMinutes) || draft.dedupeMinutes < 1 || draft.dedupeMinutes > 1440) throw new Error("Dedupe window must be a whole number from 1 to 1440 minutes.");
  if (draft.session === "custom" && (!/^\d{2}:\d{2}$/.test(draft.sessionStart) || !/^\d{2}:\d{2}$/.test(draft.sessionEnd))) throw new Error("Custom session times must use HH:MM.");
  if (draft.status === "active" && draft.symbols.length === 0) throw new Error("An active rule must name at least one instrument. A blank symbol list is only allowed for a draft.");
}

function configFromDraft(draft: RuleDraft): RuleAutomationConfig {
  return {
    status: draft.status,
    description: draft.description,
    sources: draft.sources,
    channels: draft.channels,
    symbols: draft.symbols,
    side: draft.side,
    requireSl: draft.requireSl,
    requireTp: draft.requireTp,
    session: draft.session,
    sessionStart: draft.sessionStart,
    sessionEnd: draft.sessionEnd,
    minConfidence: draft.minConfidence,
    maxSpread: draft.maxSpread,
    marketOpenOnly: draft.marketOpenOnly,
    accountIds: draft.accountIds,
    allocation: draft.allocation,
    sizeMode: draft.sizeMode,
    sizeValue: draft.sizeValue,
    stopMode: draft.stopMode,
    stopScalePct: draft.stopScalePct,
    execution: draft.execution,
    slippagePips: draft.slippagePips,
    maxTradesHour: draft.maxTradesHour,
    maxOpenPositions: draft.maxOpenPositions,
    dailyLossPct: draft.dailyLossPct,
    dedupeMinutes: draft.dedupeMinutes,
    quietHours: draft.quietHours,
    lastDryRunAt: draft.lastDryRunAt,
    lastDryRunSummary: draft.lastDryRunSummary,
    updatedAt: nowLabel(),
  };
}

export async function saveAutomationRule(draft: RuleDraft, activate: boolean): Promise<SignalRule> {
  const accounts = await getAccounts();
  const next: RuleDraft = { ...draft, status: activate ? "active" : "draft" };
  assertDraft({ ...next, status: activate ? "active" : "draft" }, accounts);
  const primary = next.sources[0] ?? "telegram";
  const account = next.accountIds[0] ?? accounts[0]?.id;
  const action = summarizeAction(next, accounts);
  const rule = await saveSignalRule({
    id: next.id,
    name: next.name.trim(),
    source: sourceToRule(primary),
    channel: next.channels[0] || "All Channels",
    conditionSummary: `IF ${summarizeCondition(next)} → ${action}`,
    accountId: account,
    accountLabel: account ? (accounts.find((a) => a.id === account)?.label ?? "Signal Desk") : "Signal Desk",
    enabled: activate,
    copilot: draft.copilot,
    automation: configFromDraft({ ...next, status: activate ? "active" : "draft" }),
  });
  logEvent({
    ruleId: rule.id,
    ruleName: rule.name,
    signalRef: "—",
    symbol: next.symbols.join(", ") || "Any",
    decision: "OPERATOR",
    reason: activate ? (next.id ? "Rule updated and activated." : "Rule created and activated.") : next.id ? "Rule updated and saved as draft." : "Rule created and saved as draft.",
    orders: [],
    latencyMs: 0,
    accountLabels: next.accountIds.map((id) => accounts.find((a) => a.id === id)?.label ?? id),
  });
  return rule;
}

export async function setAutomationRuleEnabled(ruleId: string, enabled: boolean): Promise<SignalRule> {
  const rule = await setSignalRuleEnabled(ruleId, enabled);
  logEvent({ ruleId, ruleName: rule.name, signalRef: "—", symbol: rule.conditionSummary, decision: "OPERATOR", reason: enabled ? "Rule activated." : "Rule paused.", orders: [], latencyMs: 0, accountLabels: [rule.accountLabel] });
  return rule;
}

export async function duplicateAutomationRule(rule: SignalRule, accounts: TradingAccount[]): Promise<SignalRule> {
  if ((await getSignalRules()).length >= AUTOMATION_MAX_RULES) throw new Error(`The ${AUTOMATION_MAX_RULES}-rule limit has been reached.`);
  const draft = ruleToDraft(rule, accounts);
  return saveAutomationRule({ ...draft, id: undefined, name: `${rule.name} copy`, status: "draft" }, false);
}

export async function deleteAutomationRule(rule: SignalRule): Promise<{ id: string }> {
  const result = await removeSignalRule(rule.id);
  logEvent({ ruleId: rule.id, ruleName: rule.name, signalRef: "—", symbol: rule.conditionSummary, decision: "OPERATOR", reason: "Rule deleted by operator.", orders: [], latencyMs: 0, accountLabels: [rule.accountLabel] });
  return result;
}

export async function activateAutomationRule(rule: SignalRule, accounts: TradingAccount[]): Promise<SignalRule> {
  const draft = ruleToDraft(rule, accounts);
  return saveAutomationRule({ ...draft, status: "active" }, true);
}

function riskFor(symbol: ReturnType<typeof marketSymbols.find>, size: number, slDistance: number) {
  if (!symbol) return 0;
  if (symbol.volumeUnit === "stake") return Number((size * (slDistance > 0 ? 0.75 : 1)).toFixed(2));
  if (symbol.assetClass === "Forex") return Math.abs(slDistance) * 100_000 * size;
  if (symbol.volumeUnit === "shares") return Math.abs(slDistance) * size;
  return Math.abs(slDistance) * size;
}

function safeSize(symbol: ReturnType<typeof marketSymbols.find>, requested: number) {
  if (!symbol) return Number(Math.max(0.01, requested));
  const clamped = Math.min(symbol.maxVolume, Math.max(symbol.minVolume, requested));
  return Number(clamped.toFixed(symbol.volumeUnit === "stake" ? 0 : 2));
}

export function previewDraft(
  draft: RuleDraft,
  samples: AutomationSignal[],
  accounts: TradingAccount[],
  openPositions: number,
  halted = false,
): PreviewRow[] {
  const selectedAccounts = accounts.filter((a) => draft.accountIds.includes(a.id));
  void openPositions; // Reserved for the future server-side rule evaluator.
  let executedCount = 0;
  let cumulativePnl = 0;
  let guardHit: string | null = null;
  const seen = new Set<string>();
  const hourBuckets = new Map<string, number>();
  const oldestFirst = [...samples].sort((a, b) => a.receivedAt - b.receivedAt);
  const resultBySignal = new Map<string, { decision: "EXECUTE" | "SKIP"; reason: string; guard: PreviewRow["guard"]; orders: PreviewOrder[] }>();

  for (const signal of oldestFirst) {
    const skip = (reason: string): { decision: "SKIP"; reason: string; guard: "SKIPPED" | "BLOCKED"; orders: PreviewOrder[] } => ({ decision: "SKIP", reason, guard: reason.includes("guard") || reason.includes("cap") || reason.includes("loss") || reason.includes("stake") || reason.includes("stop") ? "BLOCKED" : "SKIPPED", orders: [] });
    if (halted) { resultBySignal.set(signal.id, { ...skip("Kill switch is overriding every rule."), decision: "SKIP" }); continue; }
    if (!draft.sources.includes(signal.source)) { resultBySignal.set(signal.id, { ...skip(`Source ${sourceLabels[signal.source]} is not a trigger.`), decision: "SKIP" }); continue; }
    if (draft.channels.length && !draft.channels.some((c) => c.toLowerCase() === signal.feed.toLowerCase())) { resultBySignal.set(signal.id, { ...skip("Channel is outside the trusted allow-list."), decision: "SKIP" }); continue; }
    if (draft.symbols.length && !draft.symbols.includes(signal.symbol)) { resultBySignal.set(signal.id, { ...skip(`${signal.symbol} is not in the instrument allow-list.`), decision: "SKIP" }); continue; }
    if (draft.side !== "ANY" && signal.side !== draft.side) { resultBySignal.set(signal.id, { ...skip(`Direction ${signal.side} does not match ${draft.side}.`), decision: "SKIP" }); continue; }
    if (draft.requireSl && !signal.sl) { resultBySignal.set(signal.id, { ...skip("Mandatory stop-loss guard: no SL on the signal."), decision: "SKIP" }); continue; }
    if (draft.requireTp && !signal.tp) { resultBySignal.set(signal.id, { ...skip("No take-profit level on the signal."), decision: "SKIP" }); continue; }
    if (draft.session !== "any" && draft.session !== signal.session) { resultBySignal.set(signal.id, { ...skip(`Received in the ${signal.session} window, not ${draft.session}.`), decision: "SKIP" }); continue; }
    if (signal.confidence < draft.minConfidence) { resultBySignal.set(signal.id, { ...skip(`Parser confidence ${signal.confidence}% is below ${draft.minConfidence}%.`), decision: "SKIP" }); continue; }
    if (signal.spread > draft.maxSpread) { resultBySignal.set(signal.id, { ...skip(`Spread ${signal.spread} exceeds the ${draft.maxSpread} pt ceiling.`), decision: "SKIP" }); continue; }
    if (draft.marketOpenOnly && !signal.marketOpen) { resultBySignal.set(signal.id, { ...skip("Market is closed for this instrument."), decision: "SKIP" }); continue; }
    if (guardHit) { resultBySignal.set(signal.id, { ...skip(guardHit), decision: "SKIP" }); continue; }
    const duplicateKey = `${signal.feed}:${signal.symbol}:${signal.side}:${signal.entry}`;
    if (seen.has(duplicateKey)) { resultBySignal.set(signal.id, { ...skip(`Duplicate guard: same setup inside ${draft.dedupeMinutes} minutes.`), decision: "SKIP" }); continue; }
    const hour = Math.floor(signal.receivedAt / 3_600_000);
    if ((hourBuckets.get(String(hour)) ?? 0) >= draft.maxTradesHour) { resultBySignal.set(signal.id, { ...skip(`Hourly trade cap (${draft.maxTradesHour}) reached.`), decision: "SKIP" }); continue; }
    if (executedCount >= draft.maxOpenPositions) { guardHit = "This rule's open-position contribution cap has been reached."; resultBySignal.set(signal.id, { ...skip(guardHit), decision: "SKIP" }); continue; }
    const aggregateEquity = Math.max(1, selectedAccounts.reduce((sum, a) => sum + a.equity, 0));
    if (cumulativePnl < -(aggregateEquity * draft.dailyLossPct) / 100) { guardHit = "Daily-loss circuit breaker is locked. Re-arm it after the reset time."; resultBySignal.set(signal.id, { ...skip(guardHit), decision: "SKIP" }); continue; }

    const symbol = marketSymbols.find((s) => s.canonical === signal.symbol);
    const orders: PreviewOrder[] = selectedAccounts.flatMap((account) => {
      const brokerSymbol = mappedBrokerSymbol(symbol, account);
      if (!symbol || !brokerSymbol) return [];
      const slDistanceRaw = Math.abs(signal.entry - signal.sl);
      const slDistance = draft.stopMode === "scaled" ? slDistanceRaw * draft.stopScalePct / 100 : draft.stopMode === "defaults" ? signal.entry * 0.0075 : slDistanceRaw;
      let requested = signal.size;
      if (draft.sizeMode === "fixed") requested = draft.sizeValue;
      if (draft.sizeMode === "equity") requested = (account.equity * draft.sizeValue) / 100 / Math.max(signal.entry, 0.00001);
      if (draft.sizeMode === "risk") requested = (account.equity * draft.sizeValue) / 100 / Math.max(slDistance, 0.00001);
      if (draft.allocation === "equity") requested *= account.equity / Math.max(1, selectedAccounts[0]?.equity ?? account.equity);
      const size = safeSize(symbol, requested);
      const riskUsd = riskFor(symbol, size, slDistance);
      const pnl = riskUsd * signal.outcomeR;
      return [{
        accountId: account.id,
        accountLabel: account.label,
        broker: account.broker,
        environment: account.environment,
        symbol: brokerSymbol,
        size,
        unit: symbol.volumeUnit,
        sl: draft.stopMode === "none" ? 0 : Number((signal.entry + (signal.side === "BUY" ? -1 : 1) * slDistance).toFixed(symbol.digits)),
        tp: draft.stopMode === "none" ? 0 : Number((signal.entry + (signal.side === "BUY" ? 1 : -1) * Math.abs(signal.tp - signal.entry) * (draft.stopMode === "scaled" ? draft.stopScalePct / 100 : 1)).toFixed(symbol.digits)),
        riskUsd,
        pnl,
        mode: account.environment === "paper" ? "SIMULATED" : draft.execution === "limit" ? "LIMIT" : "PREVIEW",
      }];
    });
    if (orders.some((o) => o.riskUsd > 200)) { resultBySignal.set(signal.id, { ...skip(`Max stake per trade is $200 — requested ${Math.max(...orders.map((o) => o.riskUsd)).toFixed(2)}.`), decision: "SKIP" }); continue; }
    if (!orders.length) { resultBySignal.set(signal.id, { ...skip("No selected account offers this instrument."), decision: "SKIP" }); continue; }
    seen.add(duplicateKey);
    hourBuckets.set(String(hour), (hourBuckets.get(String(hour)) ?? 0) + 1);
    executedCount += 1;
    cumulativePnl += orders.reduce((sum, o) => sum + o.pnl, 0);
    resultBySignal.set(signal.id, { decision: "EXECUTE", reason: draft.execution === "limit" ? "Would place a limit order at the signal entry." : "Passed conditions and guards. Order would route.", guard: "PASS", orders });
  }

  return [...samples]
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .map((signal) => {
      const outcome = resultBySignal.get(signal.id)!;
      return { signal, ...outcome };
    });
}

export async function runDryRun(draft: RuleDraft, days: number, saveToRule = false): Promise<DryRunReport> {
  if (![1, 7, 30].includes(days)) throw new Error("Choose a 1, 7, or 30 day window.");
  const [accounts] = await Promise.all([getAccounts()]);
  const start = AUTOMATION_SNAPSHOT - days * 86_400_000;
  const scoped = sampleSignals.filter((s) => s.receivedAt >= start);
  const rows = previewDraft(draft, scoped, accounts.filter(a=>!isAutomationPaused(a.id,draft.id)), 0, isAutomationPaused(undefined,draft.id));
  const executedRows = rows.filter((r) => r.decision === "EXECUTE");
  const skipped = rows.filter((r) => r.guard === "SKIPPED").length;
  const blocked = rows.filter((r) => r.guard === "BLOCKED").length;
  const accountsReport = new Map<string, DryRunAccount>();
  executedRows.forEach((row) => row.orders.forEach((order) => {
    const current = accountsReport.get(order.accountId) ?? { accountId: order.accountId, label: order.accountLabel, broker: order.broker, environment: order.environment, trades: 0, allocationUsd: 0, pnl: 0 };
    current.trades += 1;
    current.allocationUsd = Number((current.allocationUsd + order.riskUsd).toFixed(2));
    current.pnl = Number((current.pnl + order.pnl).toFixed(2));
    accountsReport.set(order.accountId, current);
  }));
  const report: DryRunReport = {
    runId: `DRY-${uid().slice(0, 6).toUpperCase()}`,
    ruleId: draft.id,
    ruleName: draft.name,
    days,
    evaluated: rows.length,
    executed: executedRows.length,
    skipped,
    blocked,
    winCount: executedRows.filter((r) => r.orders.reduce((sum, o) => sum + o.pnl, 0) > 0).length,
    lossCount: executedRows.filter((r) => r.orders.reduce((sum, o) => sum + o.pnl, 0) < 0).length,
    hypotheticalPnl: Number([...accountsReport.values()].reduce((sum, a) => sum + a.pnl, 0).toFixed(2)),
    allocation: Number([...accountsReport.values()].reduce((sum, a) => sum + a.allocationUsd, 0).toFixed(2)),
    accounts: [...accountsReport.values()],
    rows: rows.slice(0, 12),
    runAt: nowLabel(),
  };
  if (saveToRule && draft.id) {
    const rules = await getSignalRules();
    const rule = rules.find((r) => r.id === draft.id);
    if (rule) {
      const next = { ...ruleToDraft(rule, accounts), lastDryRunAt: report.runAt, lastDryRunSummary: `${report.evaluated} signals · ${report.executed} would execute · ${report.hypotheticalPnl >= 0 ? "+" : ""}${(report.hypotheticalPnl / Math.max(1, accounts[0]?.equity ?? 1000) * 100).toFixed(1)}%` };
      await saveSignalRule({ id: rule.id, name: next.name, source: sourceToRule(next.sources[0] ?? "telegram"), channel: next.channels[0] || rule.channel, conditionSummary: rule.conditionSummary, accountId: next.accountIds[0] ?? rule.accountId, accountLabel: accountLabelList(accounts, next.accountIds), enabled: next.status === "active", automation: configFromDraft(next) });
    }
  }
  logEvent({ ruleId: report.ruleId ?? "draft", ruleName: report.ruleName, signalRef: report.runId, symbol: draft.symbols.join(", ") || "Any", decision: "DRY RUN", reason: `${days}-day simulation: ${report.executed} would execute, ${report.blocked} blocked, hypothetical P&L ${report.hypotheticalPnl >= 0 ? "+" : ""}$${Math.abs(report.hypotheticalPnl).toFixed(2)}. No orders were sent.`, orders: [], latencyMs: 420, accountLabels: report.accounts.map((a) => a.label) });
  return latency(report, 550, 820);
}


export async function pauseAllAutomation(rules: SignalRule[]): Promise<{ count: number }> {
  const active = rules.filter((r) => r.enabled);
  await Promise.all(active.map((r) => setAutomationRuleEnabled(r.id, false)));
  return latency({ count: active.length }, 300, 500);
}

export function auditToCsv(events: AutomationAudit[]): string {
  const rows = [
    ["timestamp", "rule", "signal", "decision", "reason", "orders", "accounts", "latency_ms"],
    ...events.map((e) => [e.timestampLabel, e.ruleName, e.signalRef, e.decision, e.reason, e.orders.join(" | "), e.accountLabels.join(" | "), String(e.latencyMs)]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export const AUTOMATION_MAX_RULES = MAX_SIGNAL_RULES;

/* ══ Redesigned T-5 page model: saved signals, scheduling, global rules ══ */

export type { DeskSignal };
export { eatTime };

/* ── Trading rules: global, apply to every automated trade ── */

export interface TradingRules {
  /** Cap on the size of one automated trade, in lots. */
  maxLotsPerTrade: number;
  /** Cap on the estimated margin one automated trade may tie up, in USD. */
  maxAmountPerTrade: number;
  /** Cap on how many automated trades may be booked per workspace day. */
  maxAutomatedPerDay: number;
  /** Auto-pause the workspace when today's realized Paper loss reaches this %. */
  autoPauseDailyLossPct: number;
}

export const tradingRuleBounds = {
  maxLotsPerTrade: [0.01, 100],
  maxAmountPerTrade: [10, 100_000],
  maxAutomatedPerDay: [1, 50],
  autoPauseDailyLossPct: [1, 50],
} as const;

export const defaultTradingRules: TradingRules = {
  maxLotsPerTrade: 2,
  maxAmountPerTrade: 500,
  maxAutomatedPerDay: 8,
  autoPauseDailyLossPct: 5,
};

const RULES_KEY = "os-trading-rules-v1";

let rulesStore: TradingRules = { ...defaultTradingRules, ...readStoredRules() };

function readStoredRules(): Partial<TradingRules> {
  try {
    const raw = globalThis.localStorage?.getItem(RULES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Partial<TradingRules>;
  } catch {
    return {};
  }
}

function clampRule(key: keyof TradingRules, value: unknown): number {
  const [min, max] = tradingRuleBounds[key];
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max)
    throw new Error(
      `${ruleLabels[key]} must be between ${min} and ${max}.`,
    );
  return key === "maxLotsPerTrade" ? Math.round(num * 100) / 100 : Math.round(num * 100) / 100;
}

export const ruleLabels: Record<keyof TradingRules, string> = {
  maxLotsPerTrade: "Max lots per trade",
  maxAmountPerTrade: "Max amount per trade",
  maxAutomatedPerDay: "Max automated trades per day",
  autoPauseDailyLossPct: "Auto-pause at daily loss",
};

export const getTradingRules = (): Promise<TradingRules> =>
  latency({ ...rulesStore }, 260, 420);

export async function saveTradingRules(next: TradingRules): Promise<TradingRules> {
  const saved: TradingRules = {
    maxLotsPerTrade: clampRule("maxLotsPerTrade", next.maxLotsPerTrade),
    maxAmountPerTrade: clampRule("maxAmountPerTrade", next.maxAmountPerTrade),
    maxAutomatedPerDay: clampRule("maxAutomatedPerDay", next.maxAutomatedPerDay),
    autoPauseDailyLossPct: clampRule("autoPauseDailyLossPct", next.autoPauseDailyLossPct),
  };
  rulesStore = saved;
  try {
    globalThis.localStorage?.setItem(RULES_KEY, JSON.stringify(saved));
  } catch {
    /* storage optional in this preview */
  }
  pushEvent(
    "rules",
    "Trading rules updated",
    `Lots ≤ ${saved.maxLotsPerTrade} · amount ≤ ${fmtUsd(saved.maxAmountPerTrade)} · ${saved.maxAutomatedPerDay}/day · auto-pause at ${saved.autoPauseDailyLossPct}% loss.`,
  );
  return latency({ ...saved }, 300, 460);
}

/* ── Saved signals: create, edit every figure, discard ───── */

export interface SignalDraft {
  symbol: string;
  side: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  size: number;
}

function validateDraft(draft: SignalDraft) {
  const symbol = String(draft.symbol ?? "").toUpperCase();
  if (!marketSymbols.some((s) => s.canonical === symbol))
    throw new Error("Choose an instrument from the market universe.");
  if (draft.side !== "BUY" && draft.side !== "SELL")
    throw new Error("Pick a direction: BUY or SELL.");
  for (const [label, value] of [
    ["Entry price", draft.entry],
    ["Stop loss", draft.sl],
    ["Take profit", draft.tp],
  ] as const)
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`${label} must be a positive number.`);
  if (!Number.isFinite(draft.size) || draft.size < 0.01 || draft.size > 100)
    throw new Error("Lots must be between 0.01 and 100.");
  return { ...draft, symbol, size: Math.round(draft.size * 100) / 100 };
}

export async function createSavedSignal(draft: SignalDraft): Promise<DeskSignal> {
  const v = validateDraft(draft);
  const saved = await savePlanSignal({
    symbol: v.symbol,
    side: v.side,
    entry: v.entry,
    sl: v.sl,
    targets: [v.tp],
    size: v.size,
    source: "paste",
    kind: "Market",
    duration: "",
    confidence: 100,
    warnings: [],
  });
  pushEvent(
    "signal",
    `Saved signal ${v.symbol}`,
    `${v.side} ${v.size} lots @ ${v.entry}, SL ${v.sl} / TP ${v.tp}.`,
    saved.id,
  );
  return saved;
}

export async function editSavedSignal(id: string, draft: SignalDraft): Promise<DeskSignal> {
  const v = validateDraft(draft);
  const saved = await updateDeskSignal(id, {
    symbol: v.symbol,
    side: v.side,
    entry: v.entry,
    sl: v.sl,
    tp: v.tp,
    size: v.size,
  });
  pushEvent(
    "signal",
    `Edited signal ${v.symbol}`,
    `Now ${v.side} ${v.size} lots @ ${v.entry}, SL ${v.sl} / TP ${v.tp}.`,
    id,
  );
  return saved;
}

export async function removeSavedSignal(id: string): Promise<{ id: string }> {
  const removed = await discardSignal(id);
  pushEvent("signal", "Signal discarded", `${removed.feed} signal removed from the saved list.`, id);
  return { id };
}

/* ── Scheduling: book a saved signal for later, under the rules ── */

let automatedToday = 0;
let automatedDay = new Date(deskNow()).getUTCDate();

function countAutomatedToday(): number {
  const day = new Date(deskNow()).getUTCDate();
  if (day !== automatedDay) {
    automatedDay = day;
    automatedToday = 0;
  }
  return automatedToday;
}

/** A future desk-time slot (`YYYY-MM-DDTHH:mm`, EAT wall clock) for the schedule form. */
export function deskScheduleSlot(offsetMinutes = 30): string {
  const eat = new Date(deskNow() + offsetMinutes * 60_000 + 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}-${p(eat.getUTCMonth() + 1)}-${p(eat.getUTCDate())}T${p(eat.getUTCHours())}:${p(eat.getUTCMinutes())}`;
}

/** Snapshot estimate of the margin one trade would tie up, in USD. */
export function estimateTradeAmount(
  symbol: string,
  size: number,
  account?: TradingAccount,
): number {
  const sym = marketSymbols.find((s) => s.canonical === symbol);
  if (!sym || !Number.isFinite(size) || size <= 0) return 0;
  let notional: number;
  if (sym.volumeUnit === "shares") notional = size * sym.bid;
  else if (sym.assetClass === "Forex") notional = size * 100_000;
  else if (sym.canonical === "XAUUSD") notional = size * 100 * sym.bid;
  else if (sym.assetClass === "Crypto") notional = size * sym.bid;
  else notional = size * sym.bid * 2;
  if (account?.broker === "deriv") return Math.round(notional * 100) / 100;
  const levMatch = account?.leverage.match(/1\s*:\s*(\d+)/);
  const lev = levMatch ? Number(levMatch[1]) : 100;
  return Math.round((notional / Math.max(1, lev)) * 100) / 100;
}

export async function scheduleSavedSignal(
  id: string,
  accountId: string,
  at: string,
): Promise<Awaited<ReturnType<typeof scheduleDeskSignal>>> {
  const rules = { ...rulesStore };
  const signals = await getSignals();
  const row = signals.find((s) => s.id === id);
  if (!row) throw new Error("Saved signal not found.");
  if (!row.order.side || row.order.entry <= 0 || row.order.sl <= 0 || (row.order.targets[0] ?? 0) <= 0)
    throw new Error("Add an entry, stop loss and take profit before automating this signal.");

  const accounts = await getAccounts();
  const paper = accounts.filter((a) => a.environment === "paper");
  const startEquity = paper.reduce((sum, a) => sum + Math.max(a.balance - (a.realizedToday ?? 0), 1), 0);
  const realized = paper.reduce((sum, a) => sum + (a.realizedToday ?? 0), 0);
  const dailyLossPct = realized < 0 && startEquity > 0 ? (-realized / startEquity) * 100 : 0;
  if (dailyLossPct >= rules.autoPauseDailyLossPct) {
    const paused = await applyKillSwitch(
      "paused",
      `Auto-pause rule: today's Paper loss ${dailyLossPct.toFixed(1)}% reached the ${rules.autoPauseDailyLossPct}% limit.`,
    );
    pushEvent(
      "control",
      "Auto-pause engaged",
      `Daily Paper loss ${dailyLossPct.toFixed(1)}% reached the ${rules.autoPauseDailyLossPct}% rule. Automation paused.`,
      paused.ref,
    );
    throw new Error(
      `Automation auto-paused: today's Paper loss (${dailyLossPct.toFixed(1)}%) reached your ${rules.autoPauseDailyLossPct}% rule. Resume from the Trading rules tab.`,
    );
  }

  if (row.order.size > rules.maxLotsPerTrade)
    throw new Error(
      `This signal is ${row.order.size} lots — your rule caps automated trades at ${rules.maxLotsPerTrade} lots. Edit the signal size first.`,
    );
  const account = accounts.find((a) => a.id === accountId);
  const amount = estimateTradeAmount(row.order.symbol, row.order.size, account);
  if (amount > rules.maxAmountPerTrade)
    throw new Error(
      `This trade would tie up about ${fmtUsd(amount)} margin — your per-trade amount rule caps it at ${fmtUsd(rules.maxAmountPerTrade)}. Reduce the lots.`,
    );
  if (countAutomatedToday() >= rules.maxAutomatedPerDay)
    throw new Error(
      `You reached the daily automation cap (${rules.maxAutomatedPerDay} trades). Raise the rule or wait for the next workspace day.`,
    );

  const outcome = await scheduleDeskSignal(id, accountId, at);
  if (outcome.mode !== "blocked") {
    automatedToday += 1;
    pushEvent(
      "schedule",
      `Scheduled ${row.order.symbol}`,
      `${row.order.side} ${row.order.size} lots at ${at.replace("T", " ")} EAT on ${account?.label ?? "the selected account"}. Runs via Trade Scheduler (T-6).`,
      outcome.ref,
    );
  }
  return outcome;
}

/* ── Master control: resume, pause, stop-all ─────────────── */

export type AutomationControlMode = "armed" | "paused" | "flattened";

export async function setAutomationControl(mode: AutomationControlMode) {
  const reason =
    mode === "armed"
      ? "Automation re-armed from the Automation page."
      : mode === "paused"
        ? "Automation paused from the Automation page."
        : "Stop-all engaged from the Automation page: close Paper positions and halt automation.";
  const outcome = await applyKillSwitch(mode, reason);
  pushEvent("control", outcome.title, outcome.detail, outcome.ref);
  return outcome;
}

/* ── Activity: what this page did ────────────────────────── */

export interface AutomationEvent {
  id: string;
  at: number;
  kind: "schedule" | "signal" | "rules" | "control";
  title: string;
  detail: string;
  ref?: string;
}

const base = deskNow();
let eventSeq = 0;
const activityStore: AutomationEvent[] = (
  [
    ["control", "Workspace re-armed", "Prior eligible automation restored after a rehearsal pause."],
    ["schedule", "Scheduled XAUUSD", "BUY 0.5 lots at 16:00 EAT on Paper Main. Runs via Trade Scheduler (T-6).", "OST-2025-00141"],
    ["schedule", "Scheduled EURUSD", "SELL 0.2 lots at 09:30 EAT on Paper Reserve. Runs via Trade Scheduler (T-6).", "OST-2025-00138"],
    ["signal", "Edited signal BTCUSDT", "Now BUY 0.05 lots @ 64250, SL 63100 / TP 66800."],
    ["signal", "Saved signal USDJPY", "SELL 0.3 lots @ 151.20, SL 152.10 / TP 149.40."],
    ["rules", "Trading rules updated", "Lots ≤ 2 · amount ≤ $500 · 8/day · auto-pause at 5% loss."],
    ["schedule", "Scheduled DE40", "BUY 1 lot at 15:45 EAT on Paper Main. Runs via Trade Scheduler (T-6).", "OST-2025-00135"],
    ["control", "Automation paused", "Rules and scheduled execution stopped. Manual tickets still pass risk checks."],
    ["signal", "Saved signal XAUUSD", "BUY 0.5 lots @ 2166.80, SL 2158.00 / TP 2185.00."],
    ["schedule", "Scheduled GBPJPY", "BUY 0.4 lots at 11:15 EAT on Paper Reserve. Runs via Trade Scheduler (T-6).", "OST-2025-00133"],
  ] as [AutomationEvent["kind"], string, string, string?][]
).map(([kind, title, detail, ref], i) => ({
  id: `evt-seed-${i + 1}`,
  at: base - (i * 47 + 21) * 60_000,
  kind,
  title,
  detail,
  ...(ref ? { ref } : {}),
}));

function pushEvent(kind: AutomationEvent["kind"], title: string, detail: string, ref?: string) {
  activityStore.unshift({
    id: `evt-${Date.now()}-${eventSeq++}`,
    at: deskNow(),
    kind,
    title,
    detail,
    ...(ref ? { ref } : {}),
  });
  if (activityStore.length > 60) activityStore.length = 60;
}

export const getAutomationActivity = (): Promise<AutomationEvent[]> =>
  latency(activityStore.slice(0, 40).map((e) => ({ ...e })), 260, 420);

export function automationEventCsv(events: AutomationEvent[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["Time (EAT)", "Kind", "Title", "Detail", "Ref"].join(","),
    ...events.map((e) => [eatTime(e.at), e.kind, e.title, e.detail, e.ref ?? ""].map(esc).join(",")),
  ];
  return rows.join("\n");
}

/* ── Helpers ─────────────────────────────────────────────── */

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
