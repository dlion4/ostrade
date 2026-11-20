import { brokerVisible, readPreferences } from "./workspacePreferences";
import { hasReadNotice, publishNotice, updateRead } from "./notificationStore";
import { mappedBrokerSymbol } from "./symbolMappings";
import { marketSymbols } from "@/data/markets";
// Dashboard service layer (T-1..T-16).
// TanStack Query consumes ONLY these functions — pages never import src/data directly.
// Paper-account actions simulate locally end-to-end; broker-API actions resolve to
// clearly labeled "Ready — executes when the backend is connected" states.

import {
  adapterSnapshots,
  DASH_MAX_SCHEDULES,
  equitySeriesByRange,
  initialAlerts,
  initialCopilotProposals,
  initialEconomicEvents,
  initialOpenPositions,
  initialRecords,
  initialSchedules,
  initialSignalRules,
  quickSignalDrafts,
  sessionClocks,
  tradingAccounts,
  type AdapterHealth,
  type AlertSeverity,
  type BrokerKey,
  type CopilotProposal,
  type DashboardAlert,
  type DashboardSchedule,
  type EconomicEvent,
  type EnvironmentKind,
  type EquityPoint,
  type EquityRange,
  type JournalRecord,
  type KillSwitchMode,
  type MarketSessionClock,
  type OpenPosition,
  type QuickSignalDraft,
  type SignalRule,
  type RuleAutomationConfig,
  type RuleSession,
  type RuleSourceKey,
  type TradingAccount,
} from "@/data/dashboard";
import { latency } from "./_latency";
import { bookPaperClosure, readTradeRiskHistory } from "./records";
import { accountPauses, addRiskAudit, breachedLossPolicy, evaluateTicket, lockdown, markEngagement, noteAttempt, noteFill, rulePauses, safeRiskText } from "./riskEngine";
import type { CarryIntent, RiskTicket } from "@/data/risk";

export { DASH_MAX_SCHEDULES };
export type {
  AdapterHealth,
  AlertSeverity,
  BrokerKey,
  CopilotProposal,
  DashboardAlert,
  DashboardSchedule,
  EconomicEvent,
  EnvironmentKind,
  EquityPoint,
  EquityRange,
  JournalRecord,
  KillSwitchMode,
  MarketSessionClock,
  OpenPosition,
  QuickSignalDraft,
  SignalRule,
  RuleAutomationConfig,
  RuleSession,
  RuleSourceKey,
  TradingAccount,
};

// Mutable in-memory stores for realistic local session state across queries
let accountsStore: TradingAccount[] = structuredClone(tradingAccounts);
const PAPER_ACCOUNTS_KEY = "os-local-paper-accounts";
try {
  const saved = JSON.parse(localStorage.getItem(PAPER_ACCOUNTS_KEY) ?? "[]") as TradingAccount[];
  if (Array.isArray(saved)) accountsStore.push(...saved.filter((a) => a.broker === "paper" && a.id?.startsWith("acc-paper-local-")));
} catch { /* browser storage optional */ }
const openingSimulatorBalances = new Map(accountsStore.filter(a => !tradingAccounts.some(seed=>seed.id===a.id)).map(a => [a.id,a.balance]));
export const getPaperOpeningBalance = (id:string) => openingSimulatorBalances.get(id);
let positionsStore: OpenPosition[] = structuredClone(initialOpenPositions);
let schedulesStore: DashboardSchedule[] = structuredClone(initialSchedules);
let usedSlotsCount = 18; // matches blueprint "18 / 50 slots"
let rulesStore: SignalRule[] = structuredClone(initialSignalRules);
let copilotStore: CopilotProposal[] = structuredClone(initialCopilotProposals);
const alertsStore: DashboardAlert[] = structuredClone(initialAlerts);
let recordsStore: JournalRecord[] = structuredClone(initialRecords);
let eventsStore: EconomicEvent[] = structuredClone(initialEconomicEvents);
let refCounter = 148;
let killSwitchStore: KillSwitchMode = "armed";
const killListeners=new Set<()=>void>();
export const getLocalKillSwitch = () => killSwitchStore;
export function subscribeKillSwitch(listener:()=>void){killListeners.add(listener);return ()=>{killListeners.delete(listener);};}
export function isAutomationPaused(accountId?:string, ruleId?:string) {
  return killSwitchStore!=="armed" || lockdown || (!!accountId&&accountPauses.has(accountId)) || (!!ruleId&&rulePauses.has(ruleId));
}
export const evaluateWorkspaceOrder = (ticket:RiskTicket, ruleRef?:string) => evaluateTicket(ticket,{accounts:accountsStore.filter(a=>brokerVisible(a.broker)),positions:positionsStore,records:readTradeRiskHistory(),state:killSwitchStore,ruleRef});

function nextOrderRef(): string {
  refCounter += 1;
  return `OST-2025-${String(refCounter).padStart(5, "0")}`;
}

function eatTimestamp(): string {
  return "16:42";
}

/* ───────────────── Queries ───────────────── */

export const getAccounts = (): Promise<TradingAccount[]> =>
  latency(accountsStore.filter(a=>brokerVisible(a.broker)), 300, 520);

export const getBrokerDefaults = () => latency(readPreferences().brokers);

export async function createPaperAccount(input: { label: string; startingBalance: number }) {
  const label = input.label.trim();
  if (label.length < 2 || label.length > 40 || accountsStore.some((a) => a.label.toLowerCase() === label.toLowerCase())) throw new Error("Choose a unique account label between 2 and 40 characters.");
  if (!Number.isFinite(input.startingBalance) || input.startingBalance < 100 || input.startingBalance > 1_000_000) throw new Error("Starting balance must be between $100 and $1,000,000.");
  const balance = Math.round(input.startingBalance * 100) / 100;
  const suffix = globalThis.crypto.randomUUID().slice(0, 8);
  const account: TradingAccount = { ...tradingAccounts[0], id: `acc-paper-local-${suffix}`, label, accountNumber: `OSP-${suffix.toUpperCase()}`, balance, equity: balance, realizedToday: 0, floatingPnl: 0, marginUsedPct: 0, todayChangePct: 0, sparkline: Array(8).fill(balance) };
  accountsStore.push(account);
  openingSimulatorBalances.set(account.id, balance);
  try {
    const saved = JSON.parse(localStorage.getItem(PAPER_ACCOUNTS_KEY) ?? "[]");
    localStorage.setItem(PAPER_ACCOUNTS_KEY, JSON.stringify([...saved, account]));
  } catch { /* session fallback */ }
  return latency(account);
}

/** Session-only funding, kept separate from realized trading P&L. */
export function applySimulatedFunding(accountId: string, amount: number) {
  const account = accountsStore.find((a) => a.id === accountId && a.broker === "paper" && a.environment === "paper");
  if (!account || !Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Only valid local Paper top-ups can update a balance.");
  account.balance = Math.round((account.balance + amount) * 100) / 100;
  account.equity = Math.round((account.equity + amount) * 100) / 100;
  return account.balance;
}

export const WITHDRAWAL_MARGIN_GUARD = 0.65;
export function calculateWithdrawable(account: TradingAccount) {
  const margin = Math.max(0, account.equity * account.marginUsedPct / 100);
  const free = Math.max(0, Math.min(account.balance, account.equity - Math.max(1, margin / WITHDRAWAL_MARGIN_GUARD)));
  return { margin, available: Math.floor(free * 100 + 1e-7) / 100 };
}

/** Commit only a locally simulated debit; re-check live in-memory equity and margin. */
export function applySimulatedWithdrawal(accountId: string, amount: number) {
  const account = accountsStore.find((a) => a.id === accountId && a.broker === "paper" && a.environment === "paper");
  if (!account || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) throw new Error("Only a valid Paper withdrawal can debit the simulator.");
  const { available, margin } = calculateWithdrawable(account);
  if (amount > available) throw new Error("The current Paper balance or margin guard no longer permits this amount.");
  account.balance = Math.round((account.balance - amount) * 100) / 100;
  account.equity = Math.round((account.equity - amount) * 100) / 100;
  account.marginUsedPct = margin / account.equity * 100;
  return account.balance;
}

export function applyPaperTransfer(fromId: string, toId: string, amount: number) {
  const from = accountsStore.find(a => a.id === fromId && a.broker === "paper" && a.environment === "paper");
  const to = accountsStore.find(a => a.id === toId && a.broker === "paper" && a.environment === "paper");
  if (!from || !to || from === to || !Number.isFinite(amount) || amount < 1 || Math.round(amount * 100) / 100 !== amount) throw new Error("Choose two distinct Paper accounts and a valid amount.");
  if (amount > calculateWithdrawable(from).available) throw new Error("The current Paper balance or margin guard no longer permits this transfer.");
  const destinationMargin = to.equity * to.marginUsedPct / 100;
  const sourceBalance = applySimulatedWithdrawal(fromId, amount);
  to.balance = Math.round((to.balance + amount) * 100) / 100;
  to.equity = Math.round((to.equity + amount) * 100) / 100;
  to.marginUsedPct = destinationMargin / to.equity * 100;
  return { sourceBalance, destinationBalance: to.balance };
}

export const getAdapters = (): Promise<AdapterHealth[]> =>
  latency(adapterSnapshots, 300, 480);

export const getEquityCurve = (
  range: EquityRange,
  accountId: string = "all"
): Promise<EquityPoint[]> => {
  const base = equitySeriesByRange[range];
  if (accountId === "all") return latency(base, 300, 500);
  const acc = accountsStore.find((a) => a.id === accountId);
  const totalConnectedEquity = accountsStore
    .filter((a) => a.connected)
    .reduce((sum, a) => sum + a.equity, 0);
  const ratio =
    acc && totalConnectedEquity > 0 ? acc.equity / totalConnectedEquity : 0.35;
  const scaled = base.map((pt) => ({
    label: pt.label,
    equity: Math.round(pt.equity * ratio * 100) / 100,
    realizedOnly: Math.round(pt.realizedOnly * ratio * 100) / 100,
    drawdownPct: pt.drawdownPct,
  }));
  return latency(scaled, 300, 480);
};

export interface PositionFilters {
  accountId?: string;
  side?: "ALL" | "BUY" | "SELL";
  search?: string;
}

export const readOpenRiskPositions = () => positionsStore.slice();
export const getPositions = (
  filters: PositionFilters = {}
): Promise<OpenPosition[]> => {
  let list = [...positionsStore];
  if (filters.accountId && filters.accountId !== "all") {
    list = list.filter((p) => p.accountId === filters.accountId);
  }
  if (filters.side && filters.side.toUpperCase() !== "ALL") {
    const s = filters.side.toUpperCase();
    list = list.filter((p) => p.side.toUpperCase() === s);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.accountLabel.toLowerCase().includes(q) ||
        p.ref.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return latency(list, 300, 540);
};

export const getSchedulesSummary = (): Promise<{
  usedSlots: number;
  maxSlots: number;
  items: DashboardSchedule[];
}> =>
  latency(
    {
      usedSlots: usedSlotsCount,
      maxSlots: DASH_MAX_SCHEDULES,
      items: schedulesStore.map(s=>isAutomationPaused(s.accountId)?{...s,active:false}:s),
    },
    300,
    500
  );

export const getSignalRules = (): Promise<SignalRule[]> =>
  latency(rulesStore.map(r=>isAutomationPaused(r.accountId,r.id)?{...r,enabled:false}:r), 300, 500);

export const getCopilotProposals = (): Promise<CopilotProposal[]> =>
  latency(copilotStore, 300, 520);

export const getAlerts = (): Promise<DashboardAlert[]> =>
  latency(alertsStore.map(a=>({...a,acknowledged:hasReadNotice(a.id)})), 300, 480);

export const getRecentRecords = (
  accountId: string = "all"
): Promise<JournalRecord[]> => {
  const rows =
    accountId === "all"
      ? recordsStore
      : recordsStore.filter((r) => r.accountId === accountId);
  return latency(rows, 300, 520);
};

export const getSessionClocks = (): Promise<MarketSessionClock[]> =>
  latency(sessionClocks, 300, 450);

export const getEconomicEvents = (): Promise<EconomicEvent[]> =>
  latency(eventsStore, 300, 500);

export const getQuickSignalDrafts = (): Promise<QuickSignalDraft[]> =>
  latency(quickSignalDrafts, 300, 450);

/* ───────────────── Mutations ───────────────── */

export interface PlaceDashboardOrderInput {
  accountId: string;
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  entry: number;
  sl: number;
  tp: number;
  origin?: "Signal" | "Manual" | "Co-Pilot" | "Scheduled";
  carry?: CarryIntent;
  overrideReason?: string;
  ruleRef?: string;
  channelNote?: string;
  sourceLabel?: string;
  sourceRef?: string;
  sizeUnit?: OpenPosition["sizeUnit"];
}

export interface DashboardMutationOutcome {
  mode: "simulated" | "ready" | "blocked";
  ref: string;
  title: string;
  detail: string;
}

function tripDailyCircuitIfNeeded(){
  if(killSwitchStore==="armed"&&breachedLossPolicy(accountsStore))void applyKillSwitch("paused","Daily loss circuit breaker crossed the configured equity limit.");
}

export function admitDashboardOrder(input:PlaceDashboardOrderInput, staging=false) {
  const origin=input.origin??"Signal";
  const ticket:RiskTicket={...input,symbol:input.symbol.toUpperCase(),channel:origin==="Co-Pilot"?"AI":origin==="Scheduled"?"Schedule":origin,subject:input.sourceRef?`${origin} · ${input.sourceRef} · ${input.symbol}`:undefined};
  const evaluated=evaluateWorkspaceOrder(ticket,input.ruleRef);
  const reason=safeRiskText(input.overrideReason??"");
  const hasHardBlock=evaluated.checks.some(c=>c.decision==="BLOCK"&&!c.overridable);
  const allowOverride=reason.length>=12&&ticket.channel==="Manual"&&!hasHardBlock;
  const checks=evaluated.checks.map(c=>allowOverride&&c.decision==="BLOCK"&&c.overridable?{...c,decision:"OVERRIDE" as const}:c);
  noteAttempt(ticket);
  if(evaluated.breaker)tripDailyCircuitIfNeeded();
  const outcome=checks.find(c=>c.decision==="BLOCK");
  const account=accountsStore.find(a=>a.id===input.accountId);
  const ref=!outcome&&!staging&&account?.broker==="paper"&&account.environment==="paper"?nextOrderRef():undefined;
  const overall=addRiskAudit({category:"Evaluation",mode:"Live local",rule:"Pre-trade admission",subject:evaluated.subject,scope:evaluated.scope,decision:outcome?"BLOCK":checks.some(c=>c.decision==="OVERRIDE")?"OVERRIDE":"PASS",detail:outcome?`${outcome.label}: ${outcome.detail}`:staging?"Staging checks passed; rechecked before fill.":"Order checks passed.",ref:ref??input.sourceRef,reason:checks.some(c=>c.decision==="OVERRIDE")?reason:undefined});
  for(const c of checks) addRiskAudit({category:c.shield?"Shield":"Evaluation",mode:"Live local",rule:c.label,subject:evaluated.subject,scope:evaluated.scope,decision:c.decision,detail:c.detail,reason:c.decision==="OVERRIDE"?reason:undefined,ref:ref??input.sourceRef??overall.id});
  return {ticket,ref,outcome,auditId:overall.id};
}

export async function placeDashboardOrder(input: PlaceDashboardOrderInput): Promise<DashboardMutationOutcome> {
  const checked=admitDashboardOrder(input);
  const acc=accountsStore.find(a=>a.id===input.accountId);
  if(checked.outcome||!acc){
    const title=checked.outcome?.label??"Account unavailable";
    const body=checked.outcome?.detail??"Select an existing account before submitting an order.";
    publishNotice({event:!checked.outcome||["market","capability","bounds","protective"].includes(checked.outcome.id)?"order.rejected":"guard.blocked",id:`guard:${checked.auditId}`,title:`Order blocked · ${title}`,body,ref:checked.auditId,accountLabel:acc?.label,severity:checked.outcome?.id==='circuit'?'Critical':undefined});
    return latency({mode:"blocked",ref:checked.auditId,title:checked.outcome?.label??"Account unavailable",detail:body});
  }

  // Paper accounts simulate locally end-to-end
  if (checked.ref) {
    const ref = checked.ref;
    noteFill(checked.ticket);
    const newPos: OpenPosition = {
      id: `pos-${ref}`,
      ref,
      accountId: acc.id,
      accountLabel: acc.label,
      broker: acc.broker,
      brokerName: acc.brokerName,
      environment: acc.environment,
      symbol: input.symbol.toUpperCase(),
      brokerSymbol: mappedBrokerSymbol(marketSymbols.find((s) => s.canonical === input.symbol.toUpperCase()), acc) ?? input.symbol.toUpperCase(),
      side: input.side,
      size: input.size,
      sizeUnit: input.sizeUnit ?? (acc.broker === "alpaca" ? "shares" : "lots"),
      entry: input.entry,
      current: input.entry,
      sl: input.sl,
      initialSl: input.sl,
      tp: input.tp,
      pnl: 0,
      pnlPct: 0,
      source: input.origin ?? "Signal",
      sourceLabel: input.sourceLabel,
      sourceRef: input.sourceRef,
      openedTimestamp: new Date().toISOString(),
      openedAt: `${eatTimestamp()} EAT`,
    };
    positionsStore = [newPos, ...positionsStore];
    acc.marginUsedPct = Math.min(95, Math.round((acc.marginUsedPct + 2.4) * 10) / 10);
    recordsStore = [
      {
        id: `rec-${ref}-filled`,
        ref,
        timeEat: eatTimestamp(),
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        origin: input.origin ?? "Signal",
        symbol: input.symbol.toUpperCase(),
        side: input.side,
        status: "Filled",
        summary: `${input.size} ${newPos.sizeUnit} @ ${input.entry}${input.channelNote ? ` · ${input.channelNote}` : ""} (SIMULATED)`,
        impact: "$0.00 open",
      },
      ...recordsStore,
    ];
    publishNotice({event:"order.filled",id:`fill:${ref}`,ref,title:`${newPos.symbol} ${newPos.side} filled on Paper`,body:`${newPos.size} ${newPos.sizeUnit} filled in the local simulator and logged to Records.`,accountLabel:acc.label});
    return latency(
      {
        mode: "simulated" as const,
        ref,
        title: `Simulated fill · ${ref}`,
        detail: `${input.side} ${input.size} ${input.symbol.toUpperCase()} @ ${input.entry} filled on ${acc.label} and logged to Records.`,
      },
      420,
      720
    );
  }

  // Non-paper broker accounts stop honestly at the inert preview state
  return latency(
    {
      mode: "ready" as const,
      ref: "PREVIEW-ONLY",
      title: "Ready — executes when the backend is connected",
      detail: `${acc.brokerName} (${acc.label}) order validated locally (${input.side} ${input.size} ${input.symbol.toUpperCase()}), but live/broker API dispatch is inert in frontend-only mode.`,
    },
    420,
    720
  );
}

/** Append a local desk event to the same journal used by the command center. */
export function recordDeskEvent(event: Omit<JournalRecord, "id" | "timeEat" | "ref"> & { ref?: string }) {
  const ref = event.ref || nextOrderRef();
  recordsStore = [{ ...event, id: crypto.randomUUID(), timeEat: eatTimestamp(), ref }, ...recordsStore];
  return ref;
}

export function getSignalAttribution(refs: string[]) {
  const refSet = new Set(refs);
  const open = positionsStore.filter(p => refSet.has(p.ref));
  const closed = recordsStore.filter(r => refSet.has(r.ref) && r.status === "Closed");
  const realized = closed.reduce((sum, r) => sum + (Number(r.impact.replace(/−/g, "-").replace(/[$,]/g, "")) || 0), 0);
  return { floating: open.reduce((sum, p) => sum + p.pnl, 0), realized, closed: closed.length };
}

export async function closePosition(
  positionId: string
): Promise<DashboardMutationOutcome> {
  const pos = positionsStore.find((p) => p.id === positionId);
  if (!pos) {
    return latency({
      mode: "blocked",
      ref: "—",
      title: "Position already closed",
      detail: "Refresh positions to view current state.",
    });
  }

  if (pos.broker === "paper" && pos.environment === "paper") {
    bookPaperClosure(pos);
    positionsStore = positionsStore.filter((p) => p.id !== positionId);
    const acc = accountsStore.find((a) => a.id === pos.accountId);
    if (acc) {
      acc.balance = Math.round((acc.balance + pos.pnl) * 100) / 100;
      acc.realizedToday = Math.round((acc.realizedToday + pos.pnl) * 100) / 100;
      acc.floatingPnl = Math.round((acc.floatingPnl - pos.pnl) * 100) / 100;
      acc.equity = Math.round((acc.balance + acc.floatingPnl) * 100) / 100;
      acc.marginUsedPct = Math.max(0, Math.round((acc.marginUsedPct - 2.4) * 10) / 10);
    }
    tripDailyCircuitIfNeeded();
    const sign = pos.pnl >= 0 ? "+" : "−";
    const formatted = `${sign}$${Math.abs(pos.pnl).toFixed(2)}`;
    recordsStore = [
      {
        id: `rec-${pos.ref}-closed`,
        ref: pos.ref,
        timeEat: eatTimestamp(),
        accountId: pos.accountId,
        accountLabel: pos.accountLabel,
        broker: pos.broker,
        origin: "Manual",
        symbol: pos.symbol,
        side: pos.side,
        status: "Closed",
        summary: `Closed ${pos.size} ${pos.sizeUnit} @ ${pos.current} (SIMULATED)`,
        impact: formatted,
      },
      ...recordsStore,
    ];
    return latency(
      {
        mode: "simulated",
        ref: pos.ref,
        title: `Position closed · ${pos.ref}`,
        detail: `${pos.symbol} closed on ${pos.accountLabel} (${formatted}) and booked to Records.`,
      },
      380,
      640
    );
  }

  return latency(
    {
      mode: "ready",
      ref: pos.ref,
      title: "Ready — executes when the backend is connected",
      detail: `Closing ${pos.brokerSymbol} on ${pos.brokerName} requires the broker WebSocket/REST adapter.`,
    },
    380,
    640
  );
}

export async function updatePositionStops(
  positionId: string,
  sl: number,
  tp: number
): Promise<DashboardMutationOutcome> {
  const pos = positionsStore.find((p) => p.id === positionId);
  if (!pos) {
    return latency({ mode: "blocked", ref: "—", title: "Position not found", detail: "" });
  }
  if (pos.broker === "deriv") {
    return latency({
      mode: "blocked",
      ref: pos.ref,
      title: "Not supported on Deriv contracts",
      detail: "Per capability matrix (§3.3), Deriv contracts do not patch MT-style SL/TP in place.",
    });
  }
  if (pos.broker === "paper" && pos.environment === "paper") {
    pos.sl = sl;
    pos.tp = tp;
    recordsStore = [
      {
        id: `rec-${Date.now()}`,
        ref: pos.ref,
        timeEat: eatTimestamp(),
        accountId: pos.accountId,
        accountLabel: pos.accountLabel,
        broker: pos.broker,
        origin: "Manual",
        symbol: pos.symbol,
        side: pos.side,
        status: "Filled",
        summary: `Updated SL → ${sl} · TP → ${tp} (SIMULATED)`,
        impact: "Stops updated",
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref: pos.ref,
      title: `Stops updated · ${pos.ref}`,
      detail: `${pos.symbol} SL ${sl} / TP ${tp} saved on ${pos.accountLabel}.`,
    });
  }
  return latency({
    mode: "ready",
    ref: pos.ref,
    title: "Ready — executes when the backend is connected",
    detail: `SL ${sl} / TP ${tp} validated for ${pos.brokerName}; awaits MetaApi/REST bridge.`,
  });
}

export async function partialClosePosition(
  positionId: string,
  volumeToClose: number
): Promise<DashboardMutationOutcome> {
  const pos = positionsStore.find((p) => p.id === positionId);
  if (!pos) {
    return latency({ mode: "blocked", ref: "—", title: "Position not found", detail: "The position may have been closed already." });
  }
  if (volumeToClose >= pos.size) {
    return closePosition(positionId);
  }
  if (pos.broker === "paper" && pos.environment === "paper") {
    const ratio = Math.min(1, Math.max(0.01, volumeToClose / pos.size));
    const realizedPnl = Math.round(pos.pnl * ratio * 100) / 100;
    const remainingSize = Math.max(0.01, Math.round((pos.size - volumeToClose) * 100) / 100);
    const remainingPnl = Math.round((pos.pnl - realizedPnl) * 100) / 100;

    pos.size = remainingSize;
    pos.pnl = remainingPnl;

    const acc = accountsStore.find((a) => a.id === pos.accountId);
    if (acc) {
      acc.balance = Math.round((acc.balance + realizedPnl) * 100) / 100;
      acc.realizedToday = Math.round((acc.realizedToday + realizedPnl) * 100) / 100;
      acc.floatingPnl = Math.round((acc.floatingPnl - realizedPnl) * 100) / 100;
      acc.equity = Math.round((acc.balance + acc.floatingPnl) * 100) / 100;
      acc.marginUsedPct = Math.max(0, Math.round((acc.marginUsedPct - 1.2) * 10) / 10);
    }
    const sign = realizedPnl >= 0 ? "+" : "−";
    const formatted = `${sign}$${Math.abs(realizedPnl).toFixed(2)}`;
    const ref = nextOrderRef();
    bookPaperClosure(pos, { ref, size: volumeToClose, pnl: realizedPnl });
    tripDailyCircuitIfNeeded();
    recordsStore = [
      {
        id: `rec-${Date.now()}`,
        ref,
        timeEat: eatTimestamp(),
        accountId: pos.accountId,
        accountLabel: pos.accountLabel,
        broker: pos.broker,
        origin: "Manual",
        symbol: pos.symbol,
        side: pos.side,
        status: "Closed",
        summary: `Partial close ${volumeToClose} ${pos.sizeUnit} @ ${pos.current} (rem. ${remainingSize}) · ${pos.ref} (SIMULATED)`,
        impact: formatted,
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref,
      title: `Partially closed · ${ref}`,
      detail: `Closed ${volumeToClose} ${pos.sizeUnit} ${pos.symbol} on ${pos.accountLabel} (${formatted}). Remaining size: ${remainingSize} ${pos.sizeUnit}.`,
    }, 360, 620);
  }

  return latency({
    mode: "ready",
    ref: pos.ref,
    title: "Ready — executes when the backend is connected",
    detail: `Partial close of ${volumeToClose} ${pos.sizeUnit} on ${pos.brokerName} (${pos.accountLabel}) requires active broker bridge.`,
  }, 360, 620);
}

export async function reversePosition(
  positionId: string
): Promise<DashboardMutationOutcome> {
  const pos = positionsStore.find((p) => p.id === positionId);
  if (!pos) {
    return latency({ mode: "blocked", ref: "—", title: "Position not found", detail: "Position does not exist." });
  }
  if (pos.broker === "paper" && pos.environment === "paper") {
    const stopDistance=Math.abs(pos.entry-pos.sl), targetDistance=Math.abs(pos.tp-pos.entry);
    const input:PlaceDashboardOrderInput={accountId:pos.accountId,symbol:pos.symbol,side:pos.side==="BUY"?"SELL":"BUY",size:pos.size,entry:pos.current,sl:pos.sl>0?(pos.side==="BUY"?pos.current+stopDistance:pos.current-stopDistance):0,tp:pos.tp>0?(pos.side==="BUY"?pos.current-targetDistance:pos.current+targetDistance):0,origin:"Manual",sizeUnit:pos.sizeUnit,sourceLabel:"Position reversal"};
    const result=evaluateWorkspaceOrder({...input,channel:"Manual"});
    if(result.checks.some(c=>c.decision==="BLOCK")) {
      const blocked=admitDashboardOrder(input,true);
      return latency({mode:"blocked",ref:blocked.auditId,title:"Reversal blocked",detail:blocked.outcome?.detail??"New equity or a valid stop is required."});
    }
    const closed=await closePosition(positionId);
    if(closed.mode!=="simulated")return closed;
    const reversed=await placeDashboardOrder(input);
    return {...reversed,detail:reversed.mode==="simulated"?reversed.detail:`Original closed; reversal not opened. ${reversed.detail}`};
  }

  return latency({
    mode: "ready",
    ref: pos.ref,
    title: "Ready — executes when the backend is connected",
    detail: `Reversing ${pos.symbol} on ${pos.brokerName} (${pos.accountLabel}) requires active broker bridge.`,
  }, 420, 700);
}

export async function bulkClosePositions(
  positionIds: string[]
): Promise<{ closedCount: number; readyCount: number; receipts: DashboardMutationOutcome[] }> {
  const receipts: DashboardMutationOutcome[] = [];
  let closedCount = 0;
  let readyCount = 0;

  for (const id of positionIds) {
    const res = await closePosition(id);
    receipts.push(res);
    if (res.mode === "simulated") closedCount++;
    else readyCount++;
  }

  return latency({ closedCount, readyCount, receipts }, 450, 750);
}

export async function toggleScheduleItem(
  scheduleId: string
): Promise<{ id: string; active: boolean }> {
  const item = schedulesStore.find((s) => s.id === scheduleId);
  if (item && (item.active || !isAutomationPaused(item.accountId))) item.active = !item.active;
  return latency({ id: scheduleId, active: item?.active ?? false }, 260, 450);
}

export async function toggleSignalRule(
  ruleId: string
): Promise<{ id: string; enabled: boolean }> {
  const rule = rulesStore.find((r) => r.id === ruleId);
  if (rule && !rule.copilot && (rule.enabled || !isAutomationPaused(rule.accountId,rule.id))) rule.enabled = !rule.enabled;
  return latency({ id: ruleId, enabled: rule?.enabled ?? false }, 260, 450);
}

export const MAX_SIGNAL_RULES = 30;
export interface SignalRuleUpsert extends Omit<SignalRule, "id" | "firedToday" | "lastDecision" | "lastReason"> {
  id?: string;
}

/** Future REST shape: POST/PATCH /signal-rules. Shared with the cockpit rule summary. */
export async function saveSignalRule(input: SignalRuleUpsert): Promise<SignalRule> {
  const existingIndex = input.id ? rulesStore.findIndex((r) => r.id === input.id) : -1;
  if (existingIndex < 0 && rulesStore.length >= MAX_SIGNAL_RULES) {
    throw new Error(`The ${MAX_SIGNAL_RULES}-rule limit has been reached. Delete or archive a rule first.`);
  }
  const current = existingIndex >= 0 ? rulesStore[existingIndex] : undefined;
  if (input.enabled && isAutomationPaused(input.accountId,input.id)) throw new Error("Automation is paused for this scope.");
  if ((current?.copilot||input.copilot) && input.enabled) throw new Error("AI preview rules remain disabled. No automation was activated.");
  const rule: SignalRule = {
    ...input,
    copilot: current?.copilot ?? input.copilot,
    id: current?.id ?? `rul-${crypto.randomUUID().slice(0, 8)}`,
    firedToday: current?.firedToday ?? 0,
    lastDecision: current?.lastDecision ?? "SKIPPED",
    lastReason: current?.lastReason ?? "Never evaluated",
  };
  if (existingIndex >= 0) rulesStore[existingIndex] = rule;
  else rulesStore = [rule, ...rulesStore];
  return latency(rule, 320, 560);
}

/** Future REST shape: PATCH /signal-rules/:id/state. */
export async function setSignalRuleEnabled(id: string, enabled: boolean): Promise<SignalRule> {
  const rule = rulesStore.find((r) => r.id === id);
  if (!rule) throw new Error("Rule not found.");
  if (enabled && isAutomationPaused(rule.accountId,id)) throw new Error("Automation is paused for this scope.");
  if (enabled && rule.copilot) throw new Error("AI preview rules remain disabled. No automation was activated.");
  rule.enabled = enabled;
  rule.automation = rule.automation ? { ...rule.automation, status: enabled ? "active" : "paused", updatedAt: "Today 16:42" } : rule.automation;
  return latency(rule, 280, 460);
}

/** Future REST shape: DELETE /signal-rules/:id. */
export async function removeSignalRule(id: string): Promise<{ id: string }> {
  if (!rulesStore.some((r) => r.id === id)) throw new Error("Rule not found.");
  rulesStore = rulesStore.filter((r) => r.id !== id);
  return latency({ id }, 280, 480);
}

export async function decideCopilotProposal(
  proposalId: string,
  decision: "approved" | "dismissed"
): Promise<DashboardMutationOutcome> {
  const prop = copilotStore.find((c) => c.id === proposalId);
  if (!prop) {
    return latency({ mode: "blocked", ref: "—", title: "Proposal not found", detail: "" });
  }
  prop.status = decision;
  if (decision === "dismissed") {
    return latency({
      mode: "simulated",
      ref: prop.id.toUpperCase(),
      title: "Proposal dismissed",
      detail: `${prop.title} archived without changes.`,
    }, 280, 480);
  }
  if (prop.environment === "paper") {
    const ref = nextOrderRef();
    recordsStore = [
      {
        id: `rec-${Date.now()}`,
        ref,
        timeEat: eatTimestamp(),
        accountId: prop.accountId,
        accountLabel: prop.accountLabel,
        broker: "paper",
        origin: "Co-Pilot",
        symbol: prop.symbol,
        side: "—",
        status: "Filled",
        summary: `Approved AI draft: ${prop.proposedAction}`,
        impact: "Applied (SIM)",
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref,
      title: `Approved on Paper · ${ref}`,
      detail: `${prop.proposedAction} applied locally and recorded in Journal.`,
    }, 360, 620);
  }
  return latency({
    mode: "ready",
    ref: "AI-PREVIEW",
    title: "Approved — executes when the backend is connected",
    detail: `${prop.proposedAction} staged for ${prop.accountLabel}; live adapter dispatch is inert.`,
  }, 360, 620);
}

export async function acknowledgeAlert(
  alertId: string
): Promise<{ id: string; acknowledged: boolean }> {
  const alert = alertsStore.find((a) => a.id === alertId);
  if (alert) updateRead([alertId]);
  return latency({ id: alertId, acknowledged: true }, 240, 420);
}

export async function acknowledgeAllAlerts(): Promise<{ count: number }> {
  const count = updateRead(alertsStore.map(a=>a.id));
  return latency({ count }, 300, 480);
}

export async function createEventGuardSchedule(
  eventId: string,
  windowMinutes: number = 15
): Promise<DashboardMutationOutcome> {
  const w = Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 15;
  const ev = eventsStore.find((e) => e.id === eventId);
  if (!ev) {
    return latency({ mode: "blocked", ref: "—", title: "Event not found", detail: "" });
  }
  if (ev.guardScheduled) {
    return latency({
      mode: "simulated",
      ref: "GUARD-ACTIVE",
      title: "News Guard already queued",
      detail: `${ev.title} already has a pre/post automation pause in the Scheduler.`,
    }, 260, 420);
  }
  if (usedSlotsCount >= DASH_MAX_SCHEDULES) {
    return latency({
      mode: "blocked",
      ref: "CAP-50",
      title: `Blocked — ${DASH_MAX_SCHEDULES} / ${DASH_MAX_SCHEDULES} slots full`,
      detail: "Clear or complete a scheduled slot in T-6 before adding another News Guard.",
    }, 260, 420);
  }
  usedSlotsCount += 1;
  ev.guardScheduled = true;
  const ref = nextOrderRef();
  schedulesStore = [
    {
      id: `sch-${Date.now()}`,
      timeEat: ev.timeEat.replace("Today · ", ""),
      countdown: ev.countdown,
      symbol: ev.affectedSymbols[0] ?? "USD",
      side: "PAUSE",
      lots: `±${w}m Guard`,
      accountId: "acc-paper-main",
      accountLabel: "All Matching Rules",
      trigger: "News Guard",
      active: true,
    },
    ...schedulesStore,
  ];
  recordsStore = [
    {
      id: `rec-${Date.now()}`,
      ref,
      timeEat: eatTimestamp(),
      accountId: "acc-paper-main",
      accountLabel: "All Accounts",
      broker: "paper",
      origin: "Scheduled",
      symbol: ev.currency,
      side: "—",
      status: "Staged",
      summary: `Queued ±${w}m News Guard around ${ev.title} (${usedSlotsCount}/${DASH_MAX_SCHEDULES} slots)`,
      impact: `${usedSlotsCount}/50 slots`,
    },
    ...recordsStore,
  ];
  return latency({
    mode: "simulated",
    ref,
    title: `News Guard queued · ${usedSlotsCount} / ${DASH_MAX_SCHEDULES} slots`,
    detail: `Rules touching ${ev.affectedSymbols.join(", ")} will pause ${w}m before and after ${ev.title}.`,
  }, 360, 620);
}

export interface CreateScheduleInput {
  symbol: string;
  side: "BUY" | "SELL";
  lots: string;
  accountId: string;
  timeEat: string;
  countdown: string;
  trigger?: DashboardSchedule["trigger"];
}

/** Future REST shape: POST /schedules. Local queue that respects MAX_SCHEDULES. */
export async function createSchedule(
  input: CreateScheduleInput
): Promise<DashboardMutationOutcome> {
  if (usedSlotsCount >= DASH_MAX_SCHEDULES) {
    return latency({
      mode: "blocked" as const,
      ref: "CAP-50",
      title: `Blocked — ${DASH_MAX_SCHEDULES} / ${DASH_MAX_SCHEDULES} slots full`,
      detail: "Clear or complete a scheduled slot in T-6 before adding another.",
    }, 260, 420);
  }
  const acc = accountsStore.find((a) => a.id === input.accountId) ?? accountsStore[0];
  usedSlotsCount += 1;
  const ref = nextOrderRef();
  schedulesStore = [
    {
      id: `sch-${Date.now()}`,
      timeEat: input.timeEat,
      countdown: input.countdown,
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      lots: input.lots,
      accountId: acc.id,
      accountLabel: acc.label,
      trigger: input.trigger ?? "Time Window",
      active: true,
    },
    ...schedulesStore,
  ];
  recordsStore = [
    {
      id: `rec-${Date.now()}`,
      ref,
      timeEat: eatTimestamp(),
      accountId: acc.id,
      accountLabel: acc.label,
      broker: acc.broker,
      origin: "Scheduled",
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      status: "Staged",
      summary: `Scheduled ${input.side} ${input.lots} ${input.symbol.toUpperCase()} for ${input.timeEat} (${usedSlotsCount}/${DASH_MAX_SCHEDULES} slots)`,
      impact: `${usedSlotsCount}/50 slots`,
    },
    ...recordsStore,
  ];
  const paper = acc.environment === "paper";
  return latency({
    mode: "simulated" as const,
    ref,
    title: `Scheduled · ${usedSlotsCount} / ${DASH_MAX_SCHEDULES} slots`,
    detail: paper
      ? `${input.side} ${input.lots} ${input.symbol.toUpperCase()} on ${acc.label} fires ${input.timeEat} (simulated fill).`
      : `${input.side} ${input.lots} ${input.symbol.toUpperCase()} queued for ${acc.label} at ${input.timeEat}; broker dispatch is ready once the backend is connected.`,
  }, 360, 620);
}

let priorRules=new Set<string>(), priorSchedules=new Set<string>();
export async function applyKillSwitch(
  nextState: KillSwitchMode, reason = "Operator used the workspace emergency control.", options?: {code?:string; quiet?:boolean; flatten?:boolean}
): Promise<DashboardMutationOutcome> {
  if(nextState==="armed"&&breachedLossPolicy(accountsStore))return latency({mode:"blocked",ref:"—",title:"Daily loss circuit breaker is still active",detail:"The daily loss policy cannot be overridden."});
  if(killSwitchStore==="flattened"&&nextState==="paused")return latency({mode:"blocked",ref:"—",title:"Close-all halt is active",detail:"Use protected re-arm rather than weakening this halt."});
  if(lockdown&&nextState==="armed"&&options?.code!=="123456")return latency({mode:"blocked",ref:"—",title:"Lockdown requires 2FA",detail:"Re-arm with the example authenticator code on Risk & Guardrails."});
  if(lockdown&&nextState!=="armed"&&!options?.quiet)return latency({mode:"blocked",ref:"—",title:"Workspace locked down",detail:"Use the protected controls on Risk & Guardrails."});
  const before=killSwitchStore;
  if(before==="armed"&&nextState!=="armed"){
    priorRules=new Set(rulesStore.filter(r=>r.enabled).map(r=>r.id));
    priorSchedules=new Set(schedulesStore.filter(r=>r.active).map(r=>r.id));
  }
  killSwitchStore=nextState;
  killListeners.forEach(listener=>listener());
  if(nextState!=="armed"){
    rulesStore=rulesStore.map(r=>({...r,enabled:false}));
    schedulesStore=schedulesStore.map(r=>({...r,active:false}));
  }else if(before!=="armed"){
    rulesStore=rulesStore.map(r=>({...r,enabled:priorRules.has(r.id)&&!r.copilot}));
    schedulesStore=schedulesStore.map(r=>({...r,active:priorSchedules.has(r.id)}));
  }
  const ref=nextOrderRef();
  let closed=0;
  if(nextState==="flattened"&&options?.flatten!==false){
    const paper=positionsStore.filter(p=>p.broker==="paper"&&p.environment==="paper");
    closed=paper.length;
    await Promise.all(paper.map(p=>closePosition(p.id)));
  }
  const title=nextState==="armed"?"System re-armed":nextState==="paused"?"Automation paused":options?.flatten===false?"Close-all engaged":`Flattened ${closed} Paper positions`;
  const outstanding=positionsStore.filter(p=>p.broker!=="paper"||p.environment!=="paper").length;
  const detail=nextState==="flattened"?`${closed} simulated closures booked. ${outstanding} broker positions remain untouched.`:nextState==="paused"?"Rules and scheduled execution stopped. Manual tickets still pass risk checks unless locked down.":"Prior eligible automation settings restored. Scoped pauses and inactive AI drafts stay in force.";
  if(!options?.quiet){
    markEngagement({at:new Date().toISOString(),reason:safeRiskText(reason),command:nextState,ref});
    addRiskAudit({category:"Control",mode:"Live local",rule:title,scope:"Workspace",subject:"Emergency control",decision:"PASS",reason:safeRiskText(reason),detail,ref});
    if(nextState!=="armed")publishNotice({event:"killswitch.engaged",id:`switch:${ref}`,title,body:detail,ref});
  }
  recordsStore=[{id:`rec-${ref}`,ref,timeEat:eatTimestamp(),accountId:"acc-paper-main",accountLabel:"Workspace",broker:"paper",origin:"Guard",symbol:"ALL",side:"—",status:"Staged",summary:title,impact:nextState.toUpperCase()},...recordsStore];
  return latency({mode:"simulated",ref,title,detail},350,600);
}
