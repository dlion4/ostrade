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
import { bookPaperClosure } from "./records";

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
let alertsStore: DashboardAlert[] = structuredClone(initialAlerts);
let recordsStore: JournalRecord[] = structuredClone(initialRecords);
let eventsStore: EconomicEvent[] = structuredClone(initialEconomicEvents);
let refCounter = 148;
let killSwitchStore: KillSwitchMode = "armed";
export const getLocalKillSwitch = () => killSwitchStore;

function nextOrderRef(): string {
  refCounter += 1;
  return `OST-2025-${String(refCounter).padStart(5, "0")}`;
}

function eatTimestamp(): string {
  return "16:42";
}

/* ───────────────── Queries ───────────────── */

export const getAccounts = (): Promise<TradingAccount[]> =>
  latency(accountsStore, 300, 520);

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
      items: schedulesStore,
    },
    300,
    500
  );

export const getSignalRules = (): Promise<SignalRule[]> =>
  latency(rulesStore, 300, 500);

export const getCopilotProposals = (): Promise<CopilotProposal[]> =>
  latency(copilotStore, 300, 520);

export const getAlerts = (): Promise<DashboardAlert[]> =>
  latency(alertsStore, 300, 480);

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
  origin?: "Signal" | "Manual" | "Co-Pilot";
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

export async function placeDashboardOrder(
  input: PlaceDashboardOrderInput
): Promise<DashboardMutationOutcome> {
  const acc = accountsStore.find((a) => a.id === input.accountId);
  if (!acc) return latency({ mode: "blocked", ref: "—", title: "Account unavailable", detail: "Select an existing account before submitting an order." });

  // Paper accounts simulate locally end-to-end
  if (acc.environment === "paper") {
    const ref = nextOrderRef();
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

  if (pos.environment === "paper") {
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
    const sign = pos.pnl >= 0 ? "+" : "−";
    const formatted = `${sign}$${Math.abs(pos.pnl).toFixed(2)}`;
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
  if (pos.environment === "paper") {
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
  if (pos.environment === "paper") {
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
  if (pos.environment === "paper") {
    // 1. Close current position
    await closePosition(positionId);
    // 2. Open opposite position
    const oppositeSide = pos.side === "BUY" ? "SELL" : "BUY";
    const ref = nextOrderRef();
    const newPos: OpenPosition = {
      id: `pos-${Date.now()}`,
      ref,
      accountId: pos.accountId,
      accountLabel: pos.accountLabel,
      broker: pos.broker,
      brokerName: pos.brokerName,
      environment: pos.environment,
      symbol: pos.symbol,
      brokerSymbol: pos.brokerSymbol,
      side: oppositeSide,
      size: pos.size,
      sizeUnit: pos.sizeUnit,
      entry: pos.current,
      current: pos.current,
      sl: 0,
      tp: 0,
      pnl: 0,
      pnlPct: 0,
      source: "Manual",
      openedTimestamp: new Date().toISOString(),
      openedAt: `${eatTimestamp()} EAT`,
    };
    positionsStore = [newPos, ...positionsStore];
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
        side: oppositeSide,
        status: "Filled",
        summary: `Reversed position: ${oppositeSide} ${pos.size} ${pos.sizeUnit} @ ${pos.current} · ${ref} (SIMULATED)`,
        impact: "$0.00 open",
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref,
      title: `Position reversed · ${ref}`,
      detail: `Closed ${pos.side} and opened ${oppositeSide} ${pos.size} ${pos.sizeUnit} ${pos.symbol} @ ${pos.current} on ${pos.accountLabel}.`,
    }, 420, 700);
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
  if (item) item.active = !item.active;
  return latency({ id: scheduleId, active: item?.active ?? false }, 260, 450);
}

export async function toggleSignalRule(
  ruleId: string
): Promise<{ id: string; enabled: boolean }> {
  const rule = rulesStore.find((r) => r.id === ruleId);
  if (rule && !rule.copilot) rule.enabled = !rule.enabled;
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
  if (current?.copilot && input.enabled) throw new Error("AI preview rules remain disabled. No automation was activated.");
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
  if (alert) alert.acknowledged = true;
  return latency({ id: alertId, acknowledged: true }, 240, 420);
}

export async function acknowledgeAllAlerts(): Promise<{ count: number }> {
  let count = 0;
  alertsStore.forEach((a) => {
    if (!a.acknowledged) {
      a.acknowledged = true;
      count += 1;
    }
  });
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

export async function applyKillSwitch(
  nextState: KillSwitchMode
): Promise<DashboardMutationOutcome> {
  killSwitchStore = nextState;
  if (nextState === "paused") {
    rulesStore = rulesStore.map((r) => ({ ...r, enabled: false }));
    schedulesStore = schedulesStore.map((s) => ({ ...s, active: false }));
    const ref = nextOrderRef();
    recordsStore = [
      {
        id: `rec-${Date.now()}`,
        ref,
        timeEat: eatTimestamp(),
        accountId: "acc-paper-main",
        accountLabel: "Workspace",
        broker: "paper",
        origin: "Guard",
        symbol: "ALL",
        side: "—",
        status: "Staged",
        summary: "Kill-switch engaged: all rules & schedules paused",
        impact: "PAUSED",
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref,
      title: "Kill-switch engaged — automation paused",
      detail: "All signal rules and scheduled slots are paused across the workspace.",
    }, 350, 580);
  }

  if (nextState === "flattened") {
    rulesStore = rulesStore.map((r) => ({ ...r, enabled: false }));
    schedulesStore = schedulesStore.map((s) => ({ ...s, active: false }));
    const paperOpen = positionsStore.filter((p) => p.environment === "paper");
    const nonPaperCount = positionsStore.filter((p) => p.environment !== "paper").length;
    paperOpen.forEach((pos) => {
      bookPaperClosure(pos);
      const acc = accountsStore.find((a) => a.id === pos.accountId);
      if (acc) {
        acc.balance = Math.round((acc.balance + pos.pnl) * 100) / 100;
        acc.realizedToday = Math.round((acc.realizedToday + pos.pnl) * 100) / 100;
        acc.floatingPnl = 0;
        acc.equity = acc.balance;
        acc.marginUsedPct = 0;
      }
    });
    positionsStore = positionsStore.filter((p) => p.environment !== "paper");
    const ref = nextOrderRef();
    recordsStore = [
      {
        id: `rec-${Date.now()}`,
        ref,
        timeEat: eatTimestamp(),
        accountId: "acc-paper-main",
        accountLabel: "Paper Workspace",
        broker: "paper",
        origin: "Guard",
        symbol: "ALL",
        side: "—",
        status: "Closed",
        summary: `Emergency flatten closed ${paperOpen.length} simulated paper positions; ${nonPaperCount} broker positions await backend connection`,
        impact: `${paperOpen.length} closed`,
      },
      ...recordsStore,
    ];
    return latency({
      mode: "simulated",
      ref,
      title: `Flattened ${paperOpen.length} Paper positions · Automation halted`,
      detail: `${nonPaperCount} non-paper demo positions remain untouched (Ready — broker flatten executes when backend is connected).`,
    }, 420, 700);
  }

  // Re-arm
  rulesStore = rulesStore.map((r, idx) => ({ ...r, enabled: !r.copilot && idx !== 6 }));
  schedulesStore = schedulesStore.map((s, idx) => ({ ...s, active: idx !== 10 }));
  return latency({
    mode: "simulated",
    ref: nextOrderRef(),
    title: "System re-armed",
    detail: "Kill-switch returned to ARMED standby and active rules/schedules restored.",
  }, 320, 520);
}
