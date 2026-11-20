// T-7 Positions & Orders — typed local mock data
// Shapes follow §8 of ostradeMO.md. Static snapshots — no live-ticking.
import type { BrokerKey, EnvironmentKind } from "./dashboard";

export interface PendingOrder {
  id: string;
  ref: string;
  accountId: string;
  accountLabel: string;
  broker: BrokerKey;
  brokerName: string;
  environment: EnvironmentKind;
  symbol: string;
  brokerSymbol: string;
  side: "BUY" | "SELL";
  orderType: "Limit" | "Stop" | "Stop-Limit";
  size: number;
  sizeUnit: "lots" | "stake" | "shares" | "units";
  triggerPrice: number;
  currentPrice: number;
  distancePips: number;
  sl: number;
  tp: number;
  timeInForce: "GTC" | "DAY" | "IOC";
  placedAt: string;
  expiry: string;
  status: "active" | "canceled" | "triggered";
  source: "Signal" | "Manual" | "Scheduled";
  comment: string;
}

export const initialPendingOrders: PendingOrder[] = [
  {
    id: "ord-201",
    ref: "OST-2025-00160",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "EURUSD",
    brokerSymbol: "EURUSD",
    side: "BUY",
    orderType: "Limit",
    size: 0.25,
    sizeUnit: "lots",
    triggerPrice: 1.0815,
    currentPrice: 1.0842,
    distancePips: 27.0,
    sl: 1.0775,
    tp: 1.0895,
    timeInForce: "GTC",
    placedAt: "15:20 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Signal",
    comment: "FX Pulse Africa buy limit",
  },
  {
    id: "ord-202",
    ref: "OST-2025-00161",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "XAUUSD",
    brokerSymbol: "XAUUSDm",
    side: "SELL",
    orderType: "Limit",
    size: 0.15,
    sizeUnit: "lots",
    triggerPrice: 2410.0,
    currentPrice: 2386.95,
    distancePips: 230.5,
    sl: 2420.0,
    tp: 2375.0,
    timeInForce: "GTC",
    placedAt: "14:45 EAT",
    expiry: "2025-03-21 00:00",
    status: "active",
    source: "Signal",
    comment: "Gold Desk VIP resistance limit",
  },
  {
    id: "ord-203",
    ref: "OST-2025-00162",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "BTCUSDT",
    brokerSymbol: "BTCUSDT",
    side: "BUY",
    orderType: "Stop",
    size: 0.1,
    sizeUnit: "units",
    triggerPrice: 65200.0,
    currentPrice: 64210.0,
    distancePips: 990.0,
    sl: 63800.0,
    tp: 68000.0,
    timeInForce: "GTC",
    placedAt: "14:10 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Scheduled",
    comment: "Breakout threshold stop",
  },
  {
    id: "ord-204",
    ref: "OST-2025-00163",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "US30",
    brokerSymbol: "US30m",
    side: "BUY",
    orderType: "Limit",
    size: 0.1,
    sizeUnit: "lots",
    triggerPrice: 38950.0,
    currentPrice: 39112.0,
    distancePips: 162.0,
    sl: 38820.0,
    tp: 39350.0,
    timeInForce: "DAY",
    placedAt: "13:30 EAT",
    expiry: "End of Day (23:59 EAT)",
    status: "active",
    source: "Manual",
    comment: "Pullback support buy limit",
  },
  {
    id: "ord-205",
    ref: "OST-2025-00164",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    broker: "deriv",
    brokerName: "Deriv",
    environment: "demo",
    symbol: "R_10",
    brokerSymbol: "R_10",
    side: "BUY",
    orderType: "Limit",
    size: 20,
    sizeUnit: "stake",
    triggerPrice: 4505.0,
    currentPrice: 4532.11,
    distancePips: 27.1,
    sl: 4480.0,
    tp: 4560.0,
    timeInForce: "GTC",
    placedAt: "12:55 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Signal",
    comment: "Staged contract proposal",
  },
  {
    id: "ord-206",
    ref: "OST-2025-00165",
    accountId: "acc-alpaca-paper",
    accountLabel: "Alpaca Paper US",
    broker: "alpaca",
    brokerName: "Alpaca",
    environment: "paper",
    symbol: "AAPL",
    brokerSymbol: "AAPL",
    side: "BUY",
    orderType: "Limit",
    size: 15,
    sizeUnit: "shares",
    triggerPrice: 224.5,
    currentPrice: 227.6,
    distancePips: 3.1,
    sl: 219.0,
    tp: 236.0,
    timeInForce: "GTC",
    placedAt: "12:15 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Manual",
    comment: "Swing entry dip",
  },
  {
    id: "ord-207",
    ref: "OST-2025-00166",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "GBPUSD",
    brokerSymbol: "GBPUSD",
    side: "SELL",
    orderType: "Stop",
    size: 0.2,
    sizeUnit: "lots",
    triggerPrice: 1.2685,
    currentPrice: 1.2712,
    distancePips: 27.0,
    sl: 1.2735,
    tp: 1.259,
    timeInForce: "GTC",
    placedAt: "11:40 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Signal",
    comment: "Breakdown stop sell",
  },
  {
    id: "ord-208",
    ref: "OST-2025-00167",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "NAS100",
    brokerSymbol: "USTECm",
    side: "BUY",
    orderType: "Stop-Limit",
    size: 0.1,
    sizeUnit: "lots",
    triggerPrice: 19920.0,
    currentPrice: 19841.7,
    distancePips: 78.3,
    sl: 19820.0,
    tp: 20150.0,
    timeInForce: "GTC",
    placedAt: "10:50 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Scheduled",
    comment: "Tech breakout continuation",
  },
  {
    id: "ord-209",
    ref: "OST-2025-00168",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "USDJPY",
    brokerSymbol: "USDJPY",
    side: "BUY",
    orderType: "Limit",
    size: 0.15,
    sizeUnit: "lots",
    triggerPrice: 155.6,
    currentPrice: 156.1,
    distancePips: 50.0,
    sl: 154.9,
    tp: 157.2,
    timeInForce: "GTC",
    placedAt: "09:30 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Manual",
    comment: "Tokyo session dip",
  },
  {
    id: "ord-210",
    ref: "OST-2025-00169",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    broker: "deriv",
    brokerName: "Deriv",
    environment: "demo",
    symbol: "R_75",
    brokerSymbol: "R_75",
    side: "BUY",
    orderType: "Limit",
    size: 30,
    sizeUnit: "stake",
    triggerPrice: 411500.0,
    currentPrice: 416420.0,
    distancePips: 4920.0,
    sl: 407000.0,
    tp: 422000.0,
    timeInForce: "GTC",
    placedAt: "08:15 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Signal",
    comment: "Multiplier contract limit",
  },
  {
    id: "ord-211",
    ref: "OST-2025-00170",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "ETHUSDT",
    brokerSymbol: "ETHUSDT",
    side: "BUY",
    orderType: "Limit",
    size: 0.5,
    sizeUnit: "units",
    triggerPrice: 3075.0,
    currentPrice: 3120.0,
    distancePips: 45.0,
    sl: 2990.0,
    tp: 3290.0,
    timeInForce: "GTC",
    placedAt: "07:45 EAT",
    expiry: "Good 'Til Cancelled",
    status: "active",
    source: "Signal",
    comment: "Weekend accumulation limit",
  },
];

export interface DerivOpenContract {
  id: string;
  contractId: string;
  accountId: string;
  accountLabel: string;
  symbol: string;
  contractType: "Rise/Fall" | "Digits" | "Multiplier" | "Accumulator" | "Touch/No Touch";
  side: "BUY" | "SELL";
  stake: number;
  payout: number;
  currentProfit: number;
  currentProfitPct: number;
  entrySpot: number;
  currentSpot: number;
  barrier: string;
  tickInfo: string;
  multiplier?: number;
  dealCancellationRemaining?: string;
  accumulatorGrowth?: string;
  status: "open" | "sold" | "won" | "lost";
  purchasedAt: string;
}

export const initialDerivContracts: DerivOpenContract[] = [
  {
    id: "drv-c101",
    contractId: "3892011928",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_75",
    contractType: "Multiplier",
    side: "BUY",
    stake: 25.0,
    payout: 68.4,
    currentProfit: 54.25,
    currentProfitPct: 217.0,
    entrySpot: 412890.5,
    currentSpot: 416420.0,
    barrier: "×200 Multiplier",
    tickInfo: "Tick 42 · In Profit",
    multiplier: 200,
    dealCancellationRemaining: "12m 45s",
    status: "open",
    purchasedAt: "13:45 EAT",
  },
  {
    id: "drv-c102",
    contractId: "3892011929",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_10",
    contractType: "Multiplier",
    side: "BUY",
    stake: 15.0,
    payout: 34.3,
    currentProfit: 19.3,
    currentProfitPct: 128.6,
    entrySpot: 4519.8,
    currentSpot: 4532.11,
    barrier: "×100 Multiplier",
    tickInfo: "Tick 88 · In Profit",
    multiplier: 100,
    dealCancellationRemaining: "Expired (Active)",
    status: "open",
    purchasedAt: "10:15 EAT",
  },
  {
    id: "drv-c103",
    contractId: "3892011930",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "1HZ50V",
    contractType: "Accumulator",
    side: "BUY",
    stake: 20.0,
    payout: 38.6,
    currentProfit: 18.6,
    currentProfitPct: 93.0,
    entrySpot: 187120.0,
    currentSpot: 187340.22,
    barrier: "2.0% growth/tick",
    tickInfo: "18 consecutive safe ticks",
    accumulatorGrowth: "2.0% / tick (Range ±45 pts)",
    status: "open",
    purchasedAt: "14:18 EAT",
  },
  {
    id: "drv-c104",
    contractId: "3892011931",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_50",
    contractType: "Rise/Fall",
    side: "BUY",
    stake: 10.0,
    payout: 19.5,
    currentProfit: 9.5,
    currentProfitPct: 95.0,
    entrySpot: 341.8,
    currentSpot: 342.61,
    barrier: "> 341.8000",
    tickInfo: "Tick 4 of 5 (Expiring next tick)",
    status: "open",
    purchasedAt: "16:38 EAT",
  },
  {
    id: "drv-c105",
    contractId: "3892011932",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "BOOM1000",
    contractType: "Multiplier",
    side: "SELL",
    stake: 12.0,
    payout: 28.0,
    currentProfit: -3.4,
    currentProfitPct: -28.3,
    entrySpot: 12460.5,
    currentSpot: 12455.87,
    barrier: "×200 Multiplier",
    tickInfo: "Spike warning active",
    multiplier: 200,
    dealCancellationRemaining: "8m 10s",
    status: "open",
    purchasedAt: "15:02 EAT",
  },
  {
    id: "drv-c106",
    contractId: "3892011933",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_25",
    contractType: "Touch/No Touch",
    side: "BUY",
    stake: 15.0,
    payout: 36.2,
    currentProfit: 21.2,
    currentProfitPct: 141.3,
    entrySpot: 1865.0,
    currentSpot: 1871.44,
    barrier: "Touches 1870.00",
    tickInfo: "Barrier touched! Payout guaranteed at expiry",
    status: "open",
    purchasedAt: "11:20 EAT",
  },
  {
    id: "drv-c107",
    contractId: "3892011934",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "1HZ10V",
    contractType: "Digits",
    side: "BUY",
    stake: 10.0,
    payout: 91.0,
    currentProfit: 0.0,
    currentProfitPct: 0.0,
    entrySpot: 9214.55,
    currentSpot: 9214.556,
    barrier: "Differs from digit 7",
    tickInfo: "Last tick digit: 6 (Safe)",
    status: "open",
    purchasedAt: "16:22 EAT",
  },
  {
    id: "drv-c108",
    contractId: "3892011935",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "CRASH1000",
    contractType: "Rise/Fall",
    side: "BUY",
    stake: 10.0,
    payout: 19.5,
    currentProfit: -10.0,
    currentProfitPct: -100.0,
    entrySpot: 8320.0,
    currentSpot: 8312.4,
    barrier: "> 8320.000",
    tickInfo: "Tick 3 of 5 · Under barrier",
    status: "open",
    purchasedAt: "16:35 EAT",
  },
  {
    id: "drv-c109",
    contractId: "3892011936",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_100",
    contractType: "Multiplier",
    side: "BUY",
    stake: 18.0,
    payout: 42.0,
    currentProfit: 8.4,
    currentProfitPct: 46.7,
    entrySpot: 2205.0,
    currentSpot: 2210.37,
    barrier: "×150 Multiplier",
    tickInfo: "Tick 54 · In Profit",
    multiplier: 150,
    dealCancellationRemaining: "Expired (Active)",
    status: "open",
    purchasedAt: "12:00 EAT",
  },
  {
    id: "drv-c110",
    contractId: "3892011937",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    symbol: "R_75",
    contractType: "Accumulator",
    side: "BUY",
    stake: 15.0,
    payout: 22.8,
    currentProfit: 7.8,
    currentProfitPct: 52.0,
    entrySpot: 415800.0,
    currentSpot: 416420.0,
    barrier: "3.0% growth/tick",
    tickInfo: "9 consecutive safe ticks",
    accumulatorGrowth: "3.0% / tick (Range ±80 pts)",
    status: "open",
    purchasedAt: "15:40 EAT",
  },
];

export interface PositionAuditStep {
  step: string;
  timeEat: string;
  detail: string;
  status: "ok" | "warn" | "info";
}

export interface PositionDetailMeta {
  positionId: string;
  idempotencyKey: string;
  brokerTicketId: string;
  latencyMs: number;
  initialMarginUsd: number;
  currentMarginUsd: number;
  swapUsd: number;
  commissionUsd: number;
  lifecycle: PositionAuditStep[];
  attribution: {
    sourceType: "Signal" | "Manual" | "Scheduled" | "Co-Pilot";
    ref: string;
    originDetail: string;
    linkUrl?: string;
  };
  tags: string[];
  notes: string[];
}

export const samplePositionMetas: Record<string, PositionDetailMeta> = {
  "pos-101": {
    positionId: "pos-101",
    idempotencyKey: "idem-gold-8829104",
    brokerTicketId: "MT-4401928",
    latencyMs: 38,
    initialMarginUsd: 476.28,
    currentMarginUsd: 477.39,
    swapUsd: 0.0,
    commissionUsd: 0.0,
    lifecycle: [
      { step: "Signal Ingested", timeEat: "14:11:42 EAT", detail: "Telegram · Gold Desk VIP: BUY XAUUSD @ 2381.40 SL 2374 TP 2402", status: "ok" },
      { step: "Guardrail Validation", timeEat: "14:11:43 EAT", detail: "Max lot check: 0.20 <= 0.50 cap · Daily loss headroom: 2.58% free", status: "ok" },
      { step: "Adapter Routing", timeEat: "14:11:43 EAT", detail: "Paper Engine local fill · simulated spread 22¢", status: "ok" },
      { step: "Order Filled", timeEat: "14:12:00 EAT", detail: "0.20 lots @ 2381.40 · Ticket OST-2025-00148", status: "ok" },
      { step: "SL / TP Monitored", timeEat: "15:30:00 EAT", detail: "Price moved +55.5 pips in favor. Breakeven recommendation drafted.", status: "info" },
    ],
    attribution: {
      sourceType: "Signal",
      ref: "SIG-0248",
      originDetail: "Telegram · Gold Desk VIP",
      linkUrl: "/dashboard/signals",
    },
    tags: ["gold", "vip-signal", "intraday", "breakout"],
    notes: ["Strong rejection off 2380 support. Target 2402 into NY close."],
  },
  "pos-103": {
    positionId: "pos-103",
    idempotencyKey: "idem-exness-774019",
    brokerTicketId: "MT5-88192004",
    latencyMs: 142,
    initialMarginUsd: 162.87,
    currentMarginUsd: 162.63,
    swapUsd: -0.42,
    commissionUsd: -1.05,
    lifecycle: [
      { step: "Signal Ingested", timeEat: "13:19:30 EAT", detail: "FX Pulse Africa · SELL EURUSD @ 1.0858 SL 1.0885 TP 1.0795", status: "ok" },
      { step: "Symbol Translation", timeEat: "13:19:31 EAT", detail: "EURUSD -> EURUSDm on Exness-MT5Trial9 via MetaApi", status: "ok" },
      { step: "Execution Receipt", timeEat: "13:20:00 EAT", detail: "0.30 lots filled @ 1.0858 · Ref OST-2025-00146", status: "ok" },
    ],
    attribution: {
      sourceType: "Signal",
      ref: "SIG-0247",
      originDetail: "Telegram · FX Pulse Africa",
      linkUrl: "/dashboard/signals",
    },
    tags: ["forex", "london-overlap", "swing"],
    notes: ["Watching EURUSDm support at 1.0820."],
  },
};

export interface AssetClassExposure {
  assetClass: string;
  notionalUsd: number;
  pctOfTotal: number;
  openCount: number;
  pnlUsd: number;
  color: string;
}

export const initialAssetExposures: AssetClassExposure[] = [
  { assetClass: "Metals", notionalUsd: 47739.0, pctOfTotal: 34.2, openCount: 1, pnlUsd: 111.0, color: "var(--os-warn)" },
  { assetClass: "Forex", notionalUsd: 41250.0, pctOfTotal: 29.5, openCount: 4, pnlUsd: 61.0, color: "var(--os-quote)" },
  { assetClass: "Indices", notionalUsd: 25480.0, pctOfTotal: 18.2, openCount: 2, pnlUsd: -66.8, color: "var(--os-ai)" },
  { assetClass: "Synthetics", notionalUsd: 15850.0, pctOfTotal: 11.3, openCount: 2, pnlUsd: 73.55, color: "var(--os-brand)" },
  { assetClass: "Crypto", notionalUsd: 8140.0, pctOfTotal: 5.8, openCount: 2, pnlUsd: 44.4, color: "var(--os-up)" },
  { assetClass: "Stocks", notionalUsd: 1283.0, pctOfTotal: 1.0, openCount: 1, pnlUsd: 41.0, color: "#64748b" },
];

export interface AccountMarginHealth {
  accountId: string;
  accountLabel: string;
  broker: BrokerKey;
  brokerName: string;
  environment: EnvironmentKind;
  equity: number;
  balance: number;
  floatingPnl: number;
  usedMargin: number;
  freeMargin: number;
  marginLevelPct: number;
  marginCallThresholdPct: number;
  stopOutLevelPct: number;
  status: "Healthy" | "Warning" | "Critical";
  leverageInUse: string;
  topExposureSymbol: string;
  topExposureNotional: number;
  topExposurePct: number;
}

export const initialAccountMarginHealth: AccountMarginHealth[] = [
  {
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    equity: 10588.9,
    balance: 10420.5,
    floatingPnl: 168.4,
    usedMargin: 1948.3,
    freeMargin: 8640.6,
    marginLevelPct: 543.5,
    marginCallThresholdPct: 100.0,
    stopOutLevelPct: 50.0,
    status: "Healthy",
    leverageInUse: "1 : 100",
    topExposureSymbol: "XAUUSD",
    topExposureNotional: 47739.0,
    topExposurePct: 45.1,
  },
  {
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    equity: 5294.0,
    balance: 5312.8,
    floatingPnl: -18.8,
    usedMargin: 3282.28,
    freeMargin: 2011.72,
    marginLevelPct: 161.3,
    marginCallThresholdPct: 60.0,
    stopOutLevelPct: 0.0,
    status: "Warning",
    leverageInUse: "1 : 200",
    topExposureSymbol: "US30",
    topExposureNotional: 19556.0,
    topExposurePct: 62.0,
  },
  {
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    broker: "deriv",
    brokerName: "Deriv",
    environment: "demo",
    equity: 9918.75,
    balance: 9845.2,
    floatingPnl: 73.55,
    usedMargin: 2192.0,
    freeMargin: 7726.75,
    marginLevelPct: 452.5,
    marginCallThresholdPct: 100.0,
    stopOutLevelPct: 50.0,
    status: "Healthy",
    leverageInUse: "Multipliers",
    topExposureSymbol: "R_75",
    topExposureNotional: 10410.5,
    topExposurePct: 22.1,
  },
  {
    accountId: "acc-alpaca-paper",
    accountLabel: "Alpaca Paper US",
    broker: "alpaca",
    brokerName: "Alpaca",
    environment: "paper",
    equity: 2521.0,
    balance: 2480.0,
    floatingPnl: 41.0,
    usedMargin: 358.0,
    freeMargin: 2163.0,
    marginLevelPct: 704.2,
    marginCallThresholdPct: 100.0,
    stopOutLevelPct: 25.0,
    status: "Healthy",
    leverageInUse: "1 : 2 Reg T",
    topExposureSymbol: "NVDA",
    topExposureNotional: 1283.0,
    topExposurePct: 14.2,
  },
];
