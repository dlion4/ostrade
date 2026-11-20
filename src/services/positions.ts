// T-7 Positions & Orders service layer
// TanStack Query consumes ONLY these functions — pages never import src/data directly.
import {
  initialPendingOrders,
  initialDerivContracts,
  samplePositionMetas,
  initialAccountMarginHealth,
  initialAssetExposures,
  type PendingOrder,
  type DerivOpenContract,
  type PositionDetailMeta,
  type AccountMarginHealth,
  type AssetClassExposure,
} from "@/data/positions";
import {
  getPositions,
  closePosition,
  updatePositionStops,
  partialClosePosition,
  reversePosition,
  bulkClosePositions,
  placeDashboardOrder,
  recordDeskEvent,
  type DashboardMutationOutcome,
  type OpenPosition,
} from "@/services/dashboard";
import { marketSymbols } from "@/data/markets";
import { latency } from "./_latency";

export type {
  PendingOrder,
  DerivOpenContract,
  PositionDetailMeta,
  AccountMarginHealth,
  AssetClassExposure,
};

// In-memory mutable stores for pending orders and deriv contracts
let pendingOrdersStore: PendingOrder[] = structuredClone(initialPendingOrders);
let derivContractsStore: DerivOpenContract[] = structuredClone(initialDerivContracts);
let positionMetasStore: Record<string, PositionDetailMeta> = structuredClone(samplePositionMetas);

export interface ConsolidatedPosition extends OpenPosition {
  swap: number;
  age: string;
  assetClass: string;
}

export interface ConsolidatedPositionsFilters {
  accountId?: string;
  broker?: string;
  assetClass?: string;
  side?: string;
  search?: string;
  environment?: string;
}

export async function getConsolidatedPositions(
  filters: ConsolidatedPositionsFilters = {}
): Promise<ConsolidatedPosition[]> {
  const sideUpper = filters.side?.toUpperCase();
  const base = await getPositions({
    accountId: filters.accountId,
    side: sideUpper === "BUY" || sideUpper === "SELL" ? sideUpper : "ALL",
    search: filters.search,
  });

  const enriched: ConsolidatedPosition[] = base.map((p, idx) => {
    const sym = marketSymbols.find((s) => s.canonical === p.symbol);
    const swapVal = p.side === "BUY" ? (sym ? parseFloat(sym.swapLong) || 0 : 0) : (sym ? parseFloat(sym.swapShort) || 0 : 0);
    const mockAges = ["18m", "45m", "1h 22m", "2h 10m", "3h 40m", "4h 05m", "5h 15m", "6h 20m", "7h 50m", "8h 30m"];
    return {
      ...p,
      swap: Math.round(swapVal * (p.size / 0.1) * 0.1 * 100) / 100,
      age: mockAges[idx % mockAges.length],
      assetClass: sym?.assetClass ?? "Forex",
    };
  });

  let result = enriched;
  if (filters.broker && filters.broker !== "all") {
    result = result.filter((p) => p.broker === filters.broker);
  }
  if (filters.assetClass && filters.assetClass !== "all") {
    result = result.filter((p) => p.assetClass === filters.assetClass);
  }
  if (filters.environment && filters.environment !== "all") {
    result = result.filter((p) => p.environment === filters.environment);
  }

  return latency(result, 300, 520);
}

export interface PendingOrdersFilters {
  accountId?: string;
  broker?: string;
  search?: string;
  status?: string;
}

export async function getPendingOrders(
  filters: PendingOrdersFilters = {}
): Promise<PendingOrder[]> {
  let list = [...pendingOrdersStore];
  if (filters.accountId && filters.accountId !== "all") {
    list = list.filter((o) => o.accountId === filters.accountId);
  }
  if (filters.broker && filters.broker !== "all") {
    list = list.filter((o) => o.broker === filters.broker);
  }
  if (filters.status && filters.status !== "all") {
    list = list.filter((o) => o.status === filters.status);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (o) =>
        o.symbol.toLowerCase().includes(q) ||
        o.accountLabel.toLowerCase().includes(q) ||
        o.ref.toLowerCase().includes(q) ||
        o.comment.toLowerCase().includes(q)
    );
  }
  return latency(list, 300, 500);
}

export async function cancelPendingOrder(
  orderId: string
): Promise<DashboardMutationOutcome> {
  const ord = pendingOrdersStore.find((o) => o.id === orderId);
  if (!ord) {
    return latency({ mode: "blocked", ref: "—", title: "Order not found", detail: "The order may have been executed or canceled." });
  }

  if (ord.environment === "paper") {
    ord.status = "canceled";
    pendingOrdersStore = pendingOrdersStore.filter((o) => o.id !== orderId);
    recordDeskEvent({
      accountId: ord.accountId,
      accountLabel: ord.accountLabel,
      broker: ord.broker,
      origin: "Manual",
      symbol: ord.symbol,
      side: ord.side,
      status: "Closed",
      summary: `Canceled pending ${ord.orderType} order for ${ord.size} ${ord.sizeUnit} @ ${ord.triggerPrice} · ${ord.ref} (SIMULATED)`,
      impact: "$0.00",
    });
    return latency({
      mode: "simulated",
      ref: ord.ref,
      title: `Order canceled · ${ord.ref}`,
      detail: `${ord.orderType} ${ord.side} ${ord.size} ${ord.symbol} canceled on ${ord.accountLabel}.`,
    }, 320, 500);
  }

  return latency({
    mode: "ready",
    ref: ord.ref,
    title: "Ready — executes when the backend is connected",
    detail: `Canceling pending order ${ord.ref} on ${ord.brokerName} (${ord.accountLabel}) requires active broker bridge.`,
  }, 320, 500);
}

export async function modifyPendingOrder(
  orderId: string,
  newPrice: number,
  newSl: number,
  newTp: number
): Promise<DashboardMutationOutcome> {
  const ord = pendingOrdersStore.find((o) => o.id === orderId);
  if (!ord) {
    return latency({ mode: "blocked", ref: "—", title: "Order not found", detail: "Order does not exist." });
  }

  if (ord.environment === "paper") {
    ord.triggerPrice = newPrice;
    ord.sl = newSl;
    ord.tp = newTp;
    recordDeskEvent({
      accountId: ord.accountId,
      accountLabel: ord.accountLabel,
      broker: ord.broker,
      origin: "Manual",
      symbol: ord.symbol,
      side: ord.side,
      status: "Staged",
      summary: `Modified pending ${ord.orderType}: Price → ${newPrice}, SL → ${newSl}, TP → ${newTp} · ${ord.ref} (SIMULATED)`,
      impact: "$0.00",
    });
    return latency({
      mode: "simulated",
      ref: ord.ref,
      title: `Order modified · ${ord.ref}`,
      detail: `Updated trigger price to ${newPrice}, SL ${newSl}, TP ${newTp} on ${ord.accountLabel}.`,
    }, 320, 520);
  }

  return latency({
    mode: "ready",
    ref: ord.ref,
    title: "Ready — executes when the backend is connected",
    detail: `Modifying pending order ${ord.ref} on ${ord.brokerName} (${ord.accountLabel}) requires active broker connection.`,
  }, 320, 520);
}

export async function executePendingOrderNow(
  orderId: string
): Promise<DashboardMutationOutcome> {
  const ord = pendingOrdersStore.find((o) => o.id === orderId);
  if (!ord) {
    return latency({ mode: "blocked", ref: "—", title: "Order not found", detail: "Order does not exist." });
  }

  if (ord.environment === "paper") {
    pendingOrdersStore = pendingOrdersStore.filter((o) => o.id !== orderId);
    const fillRes = await placeDashboardOrder({
      accountId: ord.accountId,
      symbol: ord.symbol,
      side: ord.side,
      size: ord.size,
      entry: ord.triggerPrice,
      sl: ord.sl,
      tp: ord.tp,
      origin: "Manual",
      channelNote: `Triggered pending ${ord.orderType} · ${ord.ref}`,
    });
    return fillRes;
  }

  return latency({
    mode: "ready",
    ref: ord.ref,
    title: "Ready — executes when the backend is connected",
    detail: `Market fill trigger for ${ord.brokerSymbol} on ${ord.brokerName} requires broker bridge.`,
  }, 350, 560);
}

export async function getDerivOpenContracts(): Promise<DerivOpenContract[]> {
  return latency(derivContractsStore, 300, 500);
}

export async function sellDerivContract(
  contractId: string,
  sellType: "market" | "target" = "market"
): Promise<DashboardMutationOutcome> {
  const c = derivContractsStore.find((x) => x.id === contractId || x.contractId === contractId);
  if (!c) {
    return latency({ mode: "blocked", ref: "—", title: "Contract not found", detail: "Contract already settled or expired." });
  }

  c.status = "sold";
  derivContractsStore = derivContractsStore.filter((x) => x.id !== c.id);

  const profitSign = c.currentProfit >= 0 ? "+" : "−";
  const formatted = `${profitSign}$${Math.abs(c.currentProfit).toFixed(2)}`;

  recordDeskEvent({
    accountId: c.accountId,
    accountLabel: c.accountLabel,
    broker: "deriv",
    origin: "Manual",
    symbol: c.symbol,
    side: c.side,
    status: "Closed",
    summary: `Sold ${c.contractType} contract #${c.contractId} on ${c.symbol} (${sellType === "target" ? "Profit Target" : "Market Sell"}) (SIMULATED)`,
    impact: formatted,
  });

  return latency({
    mode: "simulated",
    ref: `DRV-${c.contractId}`,
    title: `Contract sold · ${c.symbol}`,
    detail: `Sold ${c.contractType} contract #${c.contractId} on ${c.accountLabel}. Settled with ${formatted} profit.`,
  }, 360, 600);
}

export async function getPositionDetailMeta(
  positionId: string,
  pos?: OpenPosition
): Promise<PositionDetailMeta> {
  if (positionMetasStore[positionId]) {
    return latency(positionMetasStore[positionId], 280, 450);
  }

  // Generate believable default metadata if not explicitly in sample
  const defaultMeta: PositionDetailMeta = {
    positionId,
    idempotencyKey: `idem-${positionId.slice(-6)}`,
    brokerTicketId: `MT-${Math.floor(1000000 + Math.random() * 8999999)}`,
    latencyMs: 44,
    initialMarginUsd: pos ? pos.size * 500 : 250,
    currentMarginUsd: pos ? pos.size * 500 : 250,
    swapUsd: 0.0,
    commissionUsd: 0.0,
    lifecycle: [
      { step: "Order Created", timeEat: pos?.openedAt ?? "12:00 EAT", detail: `User initiated ${pos?.side ?? "BUY"} ${pos?.size ?? 0.1} ${pos?.symbol ?? "XAUUSD"}`, status: "ok" },
      { step: "Pre-Trade Guard", timeEat: pos?.openedAt ?? "12:00 EAT", detail: "All 7 pre-trade guard checks passed cleanly", status: "ok" },
      { step: "Broker Fill", timeEat: pos?.openedAt ?? "12:00 EAT", detail: `Filled @ ${pos?.entry ?? 1.0} · Ticket ${pos?.ref ?? "OST-2025-00140"}`, status: "ok" },
    ],
    attribution: {
      sourceType: (pos?.source as any) ?? "Manual",
      ref: pos?.ref ?? "REF-001",
      originDetail: `${pos?.source ?? "Manual"} order on ${pos?.accountLabel ?? "Paper Main"}`,
      linkUrl: pos?.source === "Signal" ? "/dashboard/signals" : pos?.source === "Scheduled" ? "/dashboard/scheduler" : undefined,
    },
    tags: [pos?.symbol?.toLowerCase() ?? "trade", "active-book"],
    notes: [],
  };

  positionMetasStore[positionId] = defaultMeta;
  return latency(defaultMeta, 280, 450);
}

export async function addPositionJournalNote(
  positionId: string,
  note: string,
  tags: string[]
): Promise<{ ok: boolean; message: string }> {
  const meta = positionMetasStore[positionId] ?? (await getPositionDetailMeta(positionId));
  if (note.trim()) meta.notes.push(note.trim());
  if (tags.length) meta.tags = Array.from(new Set([...meta.tags, ...tags]));

  recordDeskEvent({
    accountId: "acc-paper-main",
    accountLabel: "Position Book",
    broker: "paper",
    origin: "Manual",
    symbol: positionId,
    side: "—",
    status: "Staged",
    summary: `Position note added for ${positionId}: "${note.slice(0, 40)}"`,
    impact: "$0.00",
  });

  return latency({ ok: true, message: "Note added to position and synced with Journal (T-8)." }, 280, 450);
}

export async function getMarginExposureData(): Promise<{
  accountsHealth: AccountMarginHealth[];
  assetExposures: AssetClassExposure[];
}> {
  return latency({
    accountsHealth: initialAccountMarginHealth,
    assetExposures: initialAssetExposures,
  }, 300, 500);
}

export async function bulkMoveBreakevenPositions(
  positionIds: string[],
  bufferPips: number = 2.0
): Promise<{ count: number; message: string }> {
  const allPos = await getPositions();
  let count = 0;

  for (const id of positionIds) {
    const pos = allPos.find((p) => p.id === id);
    if (!pos || pos.environment !== "paper") continue;
    const sym = marketSymbols.find((s) => s.canonical === pos.symbol);
    const pip = sym?.pip ?? 0.0001;
    const dir = pos.side === "BUY" ? 1 : -1;
    const bePrice = Number((pos.entry + dir * bufferPips * pip).toFixed(sym?.digits ?? 4));
    await updatePositionStops(pos.id, bePrice, pos.tp);
    count++;
  }

  return latency({
    count,
    message: count > 0
      ? `Moved SL to breakeven (+${bufferPips} pips buffer) on ${count} paper position(s).`
      : "Selected positions are on live/demo brokers — breakeven executes when backend is connected.",
  }, 380, 600);
}

export async function bulkScaleOutPositions(
  positionIds: string[],
  scalePct: number = 50
): Promise<{ count: number; message: string }> {
  const allPos = await getPositions();
  let count = 0;

  for (const id of positionIds) {
    const pos = allPos.find((p) => p.id === id);
    if (!pos || pos.environment !== "paper") continue;
    const volToClose = Math.max(0.01, Math.round(pos.size * (scalePct / 100) * 100) / 100);
    await partialClosePosition(pos.id, volToClose);
    count++;
  }

  return latency({
    count,
    message: count > 0
      ? `Scaled out ${scalePct}% on ${count} paper position(s).`
      : "Selected positions are on live/demo brokers — scale-out executes when backend is connected.",
  }, 380, 600);
}

// Re-export common functions
export {
  closePosition,
  updatePositionStops,
  partialClosePosition,
  reversePosition,
  bulkClosePositions,
};
