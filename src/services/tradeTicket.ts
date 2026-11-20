// T-3 Trade Ticket service layer.
// TanStack Query consumes ONLY these functions — pages never import src/data directly.
import {
  DERIV_CONTRACT_TYPES,
  initialRecentTickets,
  ticketCapabilityRules,
  type AllocationMode,
  type DerivContractType,
  type DerivDurationUnit,
  type OrderType,
  type RecentTicket,
  type StopMode,
  type TicketCapabilityRule,
  type TimeInForce,
} from "@/data/tradeTicket";
import { marketSymbols, type MarketSymbol } from "@/data/markets";
import {
  getAccounts,
  placeDashboardOrder,
  type BrokerKey,
  type TradingAccount,
} from "@/services/dashboard";
import type { TicketDraft } from "@/services/markets";
import { latency } from "./_latency";

export { DERIV_CONTRACT_TYPES };
export type {
  AllocationMode,
  DerivContractType,
  DerivDurationUnit,
  OrderType,
  RecentTicket,
  StopMode,
  TicketCapabilityRule,
  TimeInForce,
};

let recentTicketsStore: RecentTicket[] = structuredClone(initialRecentTickets);

export const getRecentTickets = (): Promise<RecentTicket[]> =>
  latency(recentTicketsStore, 300, 500);

export const getTicketCapabilities = (): Promise<TicketCapabilityRule[]> =>
  latency(ticketCapabilityRules, 260, 420);

export function consumeStagedTicketDraft(): TicketDraft | null {
  try {
    const raw = sessionStorage.getItem("os-ticket-draft");
    if (!raw) return null;
    sessionStorage.removeItem("os-ticket-draft");
    const parsed = JSON.parse(raw) as TicketDraft;
    return parsed && parsed.canonical ? parsed : null;
  } catch {
    return null;
  }
}

export interface DerivProposalInput {
  canonical: string;
  contractType: DerivContractType;
  side: "BUY" | "SELL";
  stake: number;
  duration: number;
  durationUnit: DerivDurationUnit;
  multiplier: number;
  dealCancellation: boolean;
  growthRatePct: number;
}

export interface DerivProposalOutput {
  proposalId: string;
  canonical: string;
  contractType: DerivContractType;
  spot: number;
  barrier: string;
  stake: number;
  payout: number;
  netProfit: number;
  returnPct: number;
  commission: number;
  note: string;
}

const PAYOUT_FACTORS: Record<DerivContractType, number> = {
  "Rise/Fall": 1.95,
  "Higher/Lower": 2.12,
  "Touch/No Touch": 2.34,
  "Matches/Differs": 9.1,
  "Even/Odd": 1.94,
  "Over/Under": 2.08,
  Multiplier: 2.6,
  Accumulator: 2.25,
};

/** Future REST/WS shape: POST /deriv/proposal. Static snapshot calculation locally. */
export async function fetchDerivProposal(
  input: DerivProposalInput
): Promise<DerivProposalOutput> {
  const sym =
    marketSymbols.find((s) => s.canonical === input.canonical) ??
    marketSymbols[0];
  const factor = PAYOUT_FACTORS[input.contractType] ?? 1.95;
  const cancelFee =
    input.contractType === "Multiplier" && input.dealCancellation
      ? Math.round(input.stake * 0.045 * 100) / 100
      : 0;
  const multBoost =
    input.contractType === "Multiplier"
      ? 1 + input.multiplier / 1000
      : input.contractType === "Accumulator"
        ? 1 + input.growthRatePct * 0.12
        : 1;
  const payout = Math.round(input.stake * factor * multBoost * 100) / 100;
  const netProfit = Math.round((payout - input.stake - cancelFee) * 100) / 100;
  const returnPct =
    input.stake > 0 ? Math.round((netProfit / input.stake) * 1000) / 10 : 0;

  let barrier = `${sym.bid.toFixed(sym.digits)}`;
  if (input.contractType === "Higher/Lower") {
    const offset = sym.pip * 12 * (input.side === "BUY" ? 1 : -1);
    barrier = (sym.bid + offset).toFixed(sym.digits);
  } else if (input.contractType === "Touch/No Touch") {
    const offset = sym.pip * 22 * (input.side === "BUY" ? 1 : -1);
    barrier = (sym.bid + offset).toFixed(sym.digits);
  } else if (input.contractType === "Multiplier") {
    barrier = `×${input.multiplier} · ${input.dealCancellation ? "Cancel ON" : "No cancel"}`;
  } else if (input.contractType === "Accumulator") {
    barrier = `${input.growthRatePct}% growth / tick`;
  }

  return latency(
    {
      proposalId: `PROP-DRV-${Math.floor(10000 + Math.random() * 89999)}`,
      canonical: sym.canonical,
      contractType: input.contractType,
      spot: sym.bid,
      barrier,
      stake: input.stake,
      payout,
      netProfit,
      returnPct,
      commission: cancelFee,
      note: "Snapshot proposal preview — live Deriv WebSocket proposal stream binds when backend connects.",
    },
    320,
    560
  );
}

export interface FanoutLegInput {
  accountId: string;
  size: number;
  entry: number;
  sl: number;
  tp: number;
}

export interface FanoutTicketInput {
  canonical: string;
  orderType: OrderType;
  side: "BUY" | "SELL";
  timeInForce: TimeInForce;
  comment: string;
  legs: FanoutLegInput[];
}

export interface TicketReceiptLeg {
  accountId: string;
  accountLabel: string;
  broker: BrokerKey;
  brokerName: string;
  brokerSymbol: string;
  size: number;
  status: "filled" | "ready" | "blocked";
  fillPrice: string;
  ticketId: string;
  message: string;
}

export interface FanoutTicketResult {
  ticketRef: string;
  timestampEat: string;
  receipts: TicketReceiptLeg[];
  filledCount: number;
  readyCount: number;
  blockedCount: number;
}

/** Future REST shape: POST /orders/fanout (BullMQ parallel submission w/ idempotency key). */
export async function submitFanoutTicket(
  input: FanoutTicketInput
): Promise<FanoutTicketResult> {
  const accounts = await getAccounts();
  const sym: MarketSymbol | undefined = marketSymbols.find(
    (s) => s.canonical === input.canonical
  );

  const receipts: TicketReceiptLeg[] = [];
  let filledCount = 0;
  let readyCount = 0;
  let blockedCount = 0;

  for (const leg of input.legs) {
    const acc: TradingAccount | undefined = accounts.find(
      (a) => a.id === leg.accountId
    );
    if (!acc) continue;

    const brokerSym = sym?.brokerSymbols[acc.broker];
    if (!sym || !brokerSym) {
      blockedCount += 1;
      receipts.push({
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        brokerName: acc.brokerName,
        brokerSymbol: "—",
        size: leg.size,
        status: "blocked",
        fillPrice: "—",
        ticketId: "BLOCKED-MAP",
        message: `${input.canonical} is not offered on ${acc.brokerName}.`,
      });
      continue;
    }

    if (leg.size < sym.minVolume || leg.size > sym.maxVolume) {
      blockedCount += 1;
      receipts.push({
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        brokerName: acc.brokerName,
        brokerSymbol: brokerSym,
        size: leg.size,
        status: "blocked",
        fillPrice: "—",
        ticketId: "BLOCKED-SIZE",
        message: `Size ${leg.size} outside ${sym.minVolume}–${sym.maxVolume} ${sym.volumeUnit}.`,
      });
      continue;
    }

    const res = await placeDashboardOrder({
      accountId: acc.id,
      symbol: input.canonical,
      side: input.side,
      size: leg.size,
      entry: leg.entry,
      sl: leg.sl,
      tp: leg.tp,
      origin: "Manual",
      channelNote: `${input.orderType} · ${input.timeInForce}${input.comment ? ` · ${input.comment}` : ""}`,
    });

    if (res.mode === "simulated") {
      filledCount += 1;
      receipts.push({
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        brokerName: acc.brokerName,
        brokerSymbol: brokerSym,
        size: leg.size,
        status: "filled",
        fillPrice: leg.entry.toFixed(sym.digits),
        ticketId: res.ref,
        message: `Simulated ${input.orderType} fill recorded to Positions & Records.`,
      });
    } else if (res.mode === "ready") {
      readyCount += 1;
      receipts.push({
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        brokerName: acc.brokerName,
        brokerSymbol: brokerSym,
        size: leg.size,
        status: "ready",
        fillPrice: "—",
        ticketId: "PREVIEW-ONLY",
        message: "Ready — executes when the backend is connected.",
      });
    } else {
      blockedCount += 1;
      receipts.push({
        accountId: acc.id,
        accountLabel: acc.label,
        broker: acc.broker,
        brokerName: acc.brokerName,
        brokerSymbol: brokerSym,
        size: leg.size,
        status: "blocked",
        fillPrice: "—",
        ticketId: res.ref,
        message: res.detail,
      });
    }
  }

  const firstLeg = input.legs[0];
  const ticketRef =
    receipts.find((r) => r.status === "filled")?.ticketId ??
    `TKT-PREVIEW-${Math.floor(100 + Math.random() * 899)}`;

  const summaryParts: string[] = [];
  if (filledCount > 0) summaryParts.push(`${filledCount} simulated fill${filledCount > 1 ? "s" : ""}`);
  if (readyCount > 0) summaryParts.push(`${readyCount} backend preview${readyCount > 1 ? "s" : ""}`);
  if (blockedCount > 0) summaryParts.push(`${blockedCount} blocked`);

  const newTicket: RecentTicket = {
    id: `tkt-${Date.now()}`,
    ref: ticketRef,
    timestampEat: "16:42 EAT",
    canonical: input.canonical,
    orderType: input.orderType,
    side: input.side,
    baseSize: firstLeg?.size ?? 0.1,
    sizeUnit: sym?.volumeUnit ?? "lots",
    entry: firstLeg?.entry ?? sym?.ask ?? 0,
    sl: firstLeg?.sl ?? 0,
    tp: firstLeg?.tp ?? 0,
    accounts: receipts.map((r) => ({
      accountId: r.accountId,
      label: r.accountLabel,
      broker: r.broker,
    })),
    summary: summaryParts.join(" · ") || "No legs",
    filledCount,
    readyCount,
    blockedCount,
    comment: input.comment,
  };

  recentTicketsStore = [newTicket, ...recentTicketsStore].slice(0, 20);

  return {
    ticketRef,
    timestampEat: "16:42 EAT",
    receipts,
    filledCount,
    readyCount,
    blockedCount,
  };
}
