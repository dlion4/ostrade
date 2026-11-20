// Canonical typed local mock data for the Trader Dashboard (T-1..T-16).
// Shapes follow §8 of ostradeMO.md. Static snapshots only — prices never random-walk.
// Extend these datasets for T-2..T-16; never fork them.

export type BrokerKey =
  | "paper"
  | "deriv"
  | "exness"
  | "ctrader"
  | "alpaca"
  | "binance"
  | "oanda"
  | "icmarkets"
  | "pepperstone"
  | "xm";

export type EnvironmentKind = "paper" | "demo" | "live-ready";
export type KillSwitchMode = "armed" | "paused" | "flattened";

export interface TradingAccount {
  id: string;
  broker: BrokerKey;
  brokerName: string;
  label: string;
  accountNumber: string;
  serverOrEndpoint: string;
  environment: EnvironmentKind;
  connected: boolean;
  currency: "USD" | "USDT" | "EUR";
  balance: number;
  equity: number;
  realizedToday: number;
  floatingPnl: number;
  marginUsedPct: number;
  leverage: string;
  todayChangePct: number;
  sparkline: number[];
  canModifyStops: boolean;
  canPartialClose: boolean;
}

export const tradingAccounts: TradingAccount[] = [
  {
    id: "acc-paper-main",
    broker: "paper",
    brokerName: "OStrade Paper",
    label: "Paper Main",
    accountNumber: "OSP-10001",
    serverOrEndpoint: "Local Simulation Engine",
    environment: "paper",
    connected: true,
    currency: "USD",
    balance: 10420.5,
    equity: 10588.9,
    realizedToday: 214.5,
    floatingPnl: 168.4,
    marginUsedPct: 18.4,
    leverage: "1 : 100",
    todayChangePct: 2.12,
    sparkline: [10000, 10065, 10120, 10090, 10210, 10305, 10420, 10588.9],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-deriv-demo",
    broker: "deriv",
    brokerName: "Deriv",
    label: "Deriv Demo Synthetics",
    accountNumber: "VRTC-8841209",
    serverOrEndpoint: "wss://ws.derivws.com/websockets/v3",
    environment: "demo",
    connected: true,
    currency: "USD",
    balance: 9845.2,
    equity: 9918.75,
    realizedToday: 96.3,
    floatingPnl: 73.55,
    marginUsedPct: 22.1,
    leverage: "Multipliers",
    todayChangePct: 1.48,
    sparkline: [9650, 9700, 9680, 9745, 9790, 9830, 9865, 9918.75],
    canModifyStops: false,
    canPartialClose: true,
  },
  {
    id: "acc-exness-trial",
    broker: "exness",
    brokerName: "Exness MT5",
    label: "Exness MT5 Trial 1",
    accountNumber: "145092881",
    serverOrEndpoint: "Exness-MT5Trial9 · MetaApi",
    environment: "demo",
    connected: true,
    currency: "USD",
    balance: 5312.8,
    equity: 5294.0,
    realizedToday: 68.6,
    floatingPnl: -18.8,
    marginUsedPct: 62.0,
    leverage: "1 : 200",
    todayChangePct: 0.94,
    sparkline: [5180, 5210, 5260, 5240, 5295, 5330, 5312, 5294.0],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-alpaca-paper",
    broker: "alpaca",
    brokerName: "Alpaca",
    label: "Alpaca Paper US",
    accountNumber: "PA3K99102L",
    serverOrEndpoint: "paper-api.alpaca.markets/v2",
    environment: "paper",
    connected: true,
    currency: "USD",
    balance: 2480.0,
    equity: 2521.0,
    realizedToday: 39.0,
    floatingPnl: 41.0,
    marginUsedPct: 14.2,
    leverage: "1 : 2",
    todayChangePct: 1.65,
    sparkline: [2400, 2415, 2430, 2422, 2455, 2475, 2498, 2521.0],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-deriv-live",
    broker: "deriv",
    brokerName: "Deriv",
    label: "Deriv Real CR",
    accountNumber: "CR-4419082",
    serverOrEndpoint: "OAuth Scoped · Inert Preview",
    environment: "live-ready",
    connected: false,
    currency: "USD",
    balance: 1250.0,
    equity: 1250.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "Contract",
    todayChangePct: 0.0,
    sparkline: [1250, 1250, 1250, 1250, 1250, 1250, 1250, 1250],
    canModifyStops: false,
    canPartialClose: true,
  },
  {
    id: "acc-exness-raw",
    broker: "exness",
    brokerName: "Exness MT5",
    label: "Exness Raw Spread",
    accountNumber: "109443210",
    serverOrEndpoint: "Exness-MT5Real14 · Inert Preview",
    environment: "live-ready",
    connected: false,
    currency: "USD",
    balance: 3500.0,
    equity: 3500.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "1 : 200",
    todayChangePct: 0.0,
    sparkline: [3500, 3500, 3500, 3500, 3500, 3500, 3500, 3500],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-ctrader-demo",
    broker: "ctrader",
    brokerName: "cTrader",
    label: "cTrader Open Demo",
    accountNumber: "CT-772901",
    serverOrEndpoint: "openapi.ctrader.com · Standby",
    environment: "demo",
    connected: false,
    currency: "USD",
    balance: 10000.0,
    equity: 10000.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "1 : 100",
    todayChangePct: 0.0,
    sparkline: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-binance-testnet",
    broker: "binance",
    brokerName: "Binance",
    label: "Binance Spot Testnet",
    accountNumber: "BN-TEST-09",
    serverOrEndpoint: "testnet.binance.vision · Standby",
    environment: "demo",
    connected: false,
    currency: "USDT",
    balance: 5000.0,
    equity: 5000.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "Spot",
    todayChangePct: 0.0,
    sparkline: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-oanda-practice",
    broker: "oanda",
    brokerName: "OANDA",
    label: "OANDA v20 Practice",
    accountNumber: "101-004-2891102-001",
    serverOrEndpoint: "api-fxpractice.oanda.com · Standby",
    environment: "demo",
    connected: false,
    currency: "USD",
    balance: 25000.0,
    equity: 25000.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "1 : 50",
    todayChangePct: 0.0,
    sparkline: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
    canModifyStops: true,
    canPartialClose: true,
  },
  {
    id: "acc-icm-demo",
    broker: "icmarkets",
    brokerName: "IC Markets",
    label: "IC Markets MT5 Demo",
    accountNumber: "51009822",
    serverOrEndpoint: "ICMarketsSC-Demo04 · Standby",
    environment: "demo",
    connected: false,
    currency: "USD",
    balance: 10000.0,
    equity: 10000.0,
    realizedToday: 0,
    floatingPnl: 0,
    marginUsedPct: 0,
    leverage: "1 : 500",
    todayChangePct: 0.0,
    sparkline: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
    canModifyStops: true,
    canPartialClose: true,
  },
];

export type AdapterStatus = "live" | "reconnecting" | "standby";

export interface AdapterHealth {
  id: string;
  broker: BrokerKey;
  name: string;
  protocol: string;
  status: AdapterStatus;
  latencyMs: number;
  snapshotAgeSec: number;
  rateHeadroomPct: number;
  linkedAccounts: number;
  note: string;
  capabilities: string[];
}

export const adapterSnapshots: AdapterHealth[] = [
  {
    id: "adp-paper",
    broker: "paper",
    name: "OStrade Paper",
    protocol: "In-Memory Sim",
    status: "live",
    latencyMs: 4,
    snapshotAgeSec: 0,
    rateHeadroomPct: 100,
    linkedAccounts: 1,
    note: "Full local order execution, stop modification, partial close, and journal writes.",
    capabilities: ["Market & Pending", "Modify SL/TP", "Partial Close", "Instant Ledger"],
  },
  {
    id: "adp-deriv",
    broker: "deriv",
    name: "Deriv WS",
    protocol: "WebSocket v3 · OAuth",
    status: "live",
    latencyMs: 48,
    snapshotAgeSec: 2,
    rateHeadroomPct: 91,
    linkedAccounts: 1,
    note: "Demo snapshot active. Contract buy/sell awaits backend socket bridge.",
    capabilities: ["24/7 Synthetics", "Contract Buy/Sell", "Cashier Deep-Link", "Internal Transfer"],
  },
  {
    id: "adp-exness",
    broker: "exness",
    name: "Exness MetaApi",
    protocol: "MT5 Bridge · REST/WS",
    status: "reconnecting",
    latencyMs: 142,
    snapshotAgeSec: 9,
    rateHeadroomPct: 68,
    linkedAccounts: 1,
    note: "Trial account snapshot loaded; retry backoff simulated (attempt 2/5).",
    capabilities: ["Market & Limit", "Modify SL/TP", "Partial Close", "Manual Finance Rail"],
  },
  {
    id: "adp-alpaca",
    broker: "alpaca",
    name: "Alpaca Paper",
    protocol: "REST v2 + Stream",
    status: "live",
    latencyMs: 76,
    snapshotAgeSec: 3,
    rateHeadroomPct: 86,
    linkedAccounts: 1,
    note: "US equities & crypto paper endpoint configured; live orders inert in frontend mode.",
    capabilities: ["Bracket Orders", "Position Patch", "Partial Close", "Paper Sandbox"],
  },
  {
    id: "adp-ctrader",
    broker: "ctrader",
    name: "cTrader Open",
    protocol: "Protobuf / OAuth",
    status: "standby",
    latencyMs: 64,
    snapshotAgeSec: 30,
    rateHeadroomPct: 95,
    linkedAccounts: 0,
    note: "Adapter schema ready. Link an account in T-9 to activate snapshots.",
    capabilities: ["Market & Pending", "Modify SL/TP", "cCopy", "Full History"],
  },
  {
    id: "adp-binance",
    broker: "binance",
    name: "Binance Spot",
    protocol: "REST + UserStream",
    status: "standby",
    latencyMs: 52,
    snapshotAgeSec: 30,
    rateHeadroomPct: 94,
    linkedAccounts: 0,
    note: "Testnet & Spot adapter ready; requires trade-only API key pair.",
    capabilities: ["24/7 Crypto", "OCO / Limit", "Internal Transfer", "Crypto Rail"],
  },
  {
    id: "adp-oanda",
    broker: "oanda",
    name: "OANDA v20",
    protocol: "REST v20 Poll",
    status: "standby",
    latencyMs: 89,
    snapshotAgeSec: 45,
    rateHeadroomPct: 88,
    linkedAccounts: 0,
    note: "Practice token slot ready; positions sync via 2s poll.",
    capabilities: ["Units Sizing", "Modify SL/TP", "Partial Close", "Account History"],
  },
  {
    id: "adp-icmarkets",
    broker: "icmarkets",
    name: "IC Markets MT5",
    protocol: "MetaApi MT5",
    status: "standby",
    latencyMs: 108,
    snapshotAgeSec: 60,
    rateHeadroomPct: 90,
    linkedAccounts: 0,
    note: "Raw spread symbol suffix mapping (.a / raw) pre-loaded.",
    capabilities: ["Market & Pending", "Modify SL/TP", "Partial Close", "MT5 Demo"],
  },
  {
    id: "adp-pepperstone",
    broker: "pepperstone",
    name: "Pepperstone MT5",
    protocol: "MetaApi MT5",
    status: "standby",
    latencyMs: 112,
    snapshotAgeSec: 60,
    rateHeadroomPct: 92,
    linkedAccounts: 0,
    note: "Razor symbol map pre-loaded; awaits server + investor/trading login.",
    capabilities: ["Market & Pending", "Modify SL/TP", "Partial Close", "CopyFactory"],
  },
  {
    id: "adp-xm",
    broker: "xm",
    name: "XM Global MT5",
    protocol: "MetaApi MT5",
    status: "standby",
    latencyMs: 119,
    snapshotAgeSec: 60,
    rateHeadroomPct: 90,
    linkedAccounts: 0,
    note: "Micro & Standard lot contract-size translator configured.",
    capabilities: ["Market & Pending", "Modify SL/TP", "Micro Lots", "MT5 Trial"],
  },
];

export type EquityRange = "1D" | "1W" | "1M" | "3M" | "ALL";

export interface EquityPoint {
  label: string;
  equity: number;
  realizedOnly: number;
  drawdownPct: number;
}

export const equitySeriesByRange: Record<EquityRange, EquityPoint[]> = {
  "1D": [
    { label: "00:00", equity: 27420, realizedOnly: 27420, drawdownPct: -0.2 },
    { label: "03:00", equity: 27510, realizedOnly: 27465, drawdownPct: -0.1 },
    { label: "06:00", equity: 27480, realizedOnly: 27490, drawdownPct: -0.35 },
    { label: "08:00", equity: 27640, realizedOnly: 27580, drawdownPct: -0.08 },
    { label: "10:00", equity: 27795, realizedOnly: 27690, drawdownPct: 0 },
    { label: "12:00", equity: 27730, realizedOnly: 27740, drawdownPct: -0.24 },
    { label: "14:00", equity: 27920, realizedOnly: 27830, drawdownPct: 0 },
    { label: "16:00", equity: 28140, realizedOnly: 27960, drawdownPct: 0 },
    { label: "18:00", equity: 28245, realizedOnly: 28020, drawdownPct: 0 },
    { label: "Now", equity: 28322.65, realizedOnly: 28058.5, drawdownPct: 0 },
  ],
  "1W": [
    { label: "Mon", equity: 26480, realizedOnly: 26420, drawdownPct: -0.6 },
    { label: "Tue", equity: 26890, realizedOnly: 26780, drawdownPct: -0.2 },
    { label: "Wed", equity: 26710, realizedOnly: 26810, drawdownPct: -0.85 },
    { label: "Thu", equity: 27340, realizedOnly: 27190, drawdownPct: -0.15 },
    { label: "Fri", equity: 27860, realizedOnly: 27680, drawdownPct: 0 },
    { label: "Sat", equity: 28010, realizedOnly: 27890, drawdownPct: 0 },
    { label: "Today", equity: 28322.65, realizedOnly: 28058.5, drawdownPct: 0 },
  ],
  "1M": [
    { label: "Wk 1", equity: 24900, realizedOnly: 24850, drawdownPct: -1.1 },
    { label: "Wk 2", equity: 25640, realizedOnly: 25490, drawdownPct: -0.5 },
    { label: "Wk 3", equity: 26120, realizedOnly: 26040, drawdownPct: -0.9 },
    { label: "Wk 4", equity: 27450, realizedOnly: 27280, drawdownPct: -0.2 },
    { label: "Now", equity: 28322.65, realizedOnly: 28058.5, drawdownPct: 0 },
  ],
  "3M": [
    { label: "Jan", equity: 22100, realizedOnly: 22100, drawdownPct: -1.8 },
    { label: "Feb 1", equity: 23450, realizedOnly: 23300, drawdownPct: -0.9 },
    { label: "Feb 15", equity: 24120, realizedOnly: 24080, drawdownPct: -1.4 },
    { label: "Mar 1", equity: 25890, realizedOnly: 25710, drawdownPct: -0.6 },
    { label: "Mar 15", equity: 27180, realizedOnly: 26990, drawdownPct: -0.3 },
    { label: "Now", equity: 28322.65, realizedOnly: 28058.5, drawdownPct: 0 },
  ],
  ALL: [
    { label: "Q3", equity: 18500, realizedOnly: 18500, drawdownPct: -2.4 },
    { label: "Q4", equity: 21400, realizedOnly: 21250, drawdownPct: -1.7 },
    { label: "Jan", equity: 23800, realizedOnly: 23650, drawdownPct: -1.2 },
    { label: "Feb", equity: 25950, realizedOnly: 25800, drawdownPct: -0.8 },
    { label: "Mar", equity: 27420, realizedOnly: 27240, drawdownPct: -0.4 },
    { label: "Now", equity: 28322.65, realizedOnly: 28058.5, drawdownPct: 0 },
  ],
};

export interface OpenPosition {
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
  size: number;
  sizeUnit: "lots" | "stake" | "shares" | "units";
  entry: number;
  current: number;
  sl: number;
  tp: number;
  pnl: number;
  pnlPct: number;
  source: "Signal" | "Scheduled" | "Manual";
  openedAt: string;
}

export const initialOpenPositions: OpenPosition[] = [
  {
    id: "pos-101",
    ref: "OST-2025-00148",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "XAUUSD",
    brokerSymbol: "XAUUSD",
    side: "BUY",
    size: 0.2,
    sizeUnit: "lots",
    entry: 2381.4,
    current: 2386.95,
    sl: 2374.0,
    tp: 2402.0,
    pnl: 111.0,
    pnlPct: 1.06,
    source: "Signal",
    openedAt: "14:12 EAT",
  },
  {
    id: "pos-102",
    ref: "OST-2025-00147",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    broker: "deriv",
    brokerName: "Deriv",
    environment: "demo",
    symbol: "R_75",
    brokerSymbol: "R_75",
    side: "BUY",
    size: 25,
    sizeUnit: "stake",
    entry: 412890.5,
    current: 416420.0,
    sl: 409500.0,
    tp: 421000.0,
    pnl: 54.25,
    pnlPct: 0.55,
    source: "Scheduled",
    openedAt: "13:45 EAT",
  },
  {
    id: "pos-103",
    ref: "OST-2025-00146",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "EURUSD",
    brokerSymbol: "EURUSDm",
    side: "SELL",
    size: 0.3,
    sizeUnit: "lots",
    entry: 1.0858,
    current: 1.0842,
    sl: 1.0885,
    tp: 1.0795,
    pnl: 48.0,
    pnlPct: 0.91,
    source: "Signal",
    openedAt: "13:20 EAT",
  },
  {
    id: "pos-104",
    ref: "OST-2025-00145",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "US30",
    brokerSymbol: "US30m",
    side: "SELL",
    size: 0.15,
    sizeUnit: "lots",
    entry: 39065.0,
    current: 39112.0,
    sl: 39240.0,
    tp: 38790.0,
    pnl: -70.5,
    pnlPct: -1.33,
    source: "Signal",
    openedAt: "12:55 EAT",
  },
  {
    id: "pos-105",
    ref: "OST-2025-00144",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "BTCUSDT",
    brokerSymbol: "BTCUSDT",
    side: "BUY",
    size: 0.08,
    sizeUnit: "lots",
    entry: 63680.0,
    current: 64210.0,
    sl: 62900.0,
    tp: 65800.0,
    pnl: 42.4,
    pnlPct: 0.41,
    source: "Signal",
    openedAt: "12:10 EAT",
  },
  {
    id: "pos-106",
    ref: "OST-2025-00143",
    accountId: "acc-alpaca-paper",
    accountLabel: "Alpaca Paper US",
    broker: "alpaca",
    brokerName: "Alpaca",
    environment: "paper",
    symbol: "NVDA",
    brokerSymbol: "NVDA",
    side: "BUY",
    size: 10,
    sizeUnit: "shares",
    entry: 124.2,
    current: 128.3,
    sl: 120.5,
    tp: 135.0,
    pnl: 41.0,
    pnlPct: 1.65,
    source: "Manual",
    openedAt: "11:30 EAT",
  },
  {
    id: "pos-107",
    ref: "OST-2025-00142",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "GBPUSD",
    brokerSymbol: "GBPUSD",
    side: "SELL",
    size: 0.25,
    sizeUnit: "lots",
    entry: 1.2724,
    current: 1.2712,
    sl: 1.276,
    tp: 1.265,
    pnl: 30.0,
    pnlPct: 0.29,
    source: "Signal",
    openedAt: "10:48 EAT",
  },
  {
    id: "pos-108",
    ref: "OST-2025-00141",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo Synthetics",
    broker: "deriv",
    brokerName: "Deriv",
    environment: "demo",
    symbol: "R_10",
    brokerSymbol: "R_10",
    side: "BUY",
    size: 15,
    sizeUnit: "stake",
    entry: 4519.8,
    current: 4532.11,
    sl: 4495.0,
    tp: 4580.0,
    pnl: 19.3,
    pnlPct: 0.2,
    source: "Signal",
    openedAt: "10:15 EAT",
  },
  {
    id: "pos-109",
    ref: "OST-2025-00140",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "USDJPY",
    brokerSymbol: "USDJPY",
    side: "BUY",
    size: 0.2,
    sizeUnit: "lots",
    entry: 156.28,
    current: 156.1,
    sl: 155.4,
    tp: 157.4,
    pnl: -15.0,
    pnlPct: -0.14,
    source: "Scheduled",
    openedAt: "09:30 EAT",
  },
  {
    id: "pos-110",
    ref: "OST-2025-00139",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    broker: "exness",
    brokerName: "Exness MT5",
    environment: "demo",
    symbol: "NAS100",
    brokerSymbol: "USTECm",
    side: "BUY",
    size: 0.1,
    sizeUnit: "lots",
    entry: 19838.0,
    current: 19841.7,
    sl: 19760.0,
    tp: 19980.0,
    pnl: 3.7,
    pnlPct: 0.07,
    source: "Manual",
    openedAt: "09:05 EAT",
  },
  {
    id: "pos-111",
    ref: "OST-2025-00138",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "ETHUSDT",
    brokerSymbol: "ETHUSDT",
    side: "BUY",
    size: 0.4,
    sizeUnit: "lots",
    entry: 3115.0,
    current: 3120.0,
    sl: 3040.0,
    tp: 3280.0,
    pnl: 2.0,
    pnlPct: 0.02,
    source: "Signal",
    openedAt: "08:40 EAT",
  },
  {
    id: "pos-112",
    ref: "OST-2025-00137",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    broker: "paper",
    brokerName: "OStrade Paper",
    environment: "paper",
    symbol: "AUDUSD",
    brokerSymbol: "AUDUSD",
    side: "SELL",
    size: 0.15,
    sizeUnit: "lots",
    entry: 0.6639,
    current: 0.6641,
    sl: 0.668,
    tp: 0.6575,
    pnl: -2.0,
    pnlPct: -0.02,
    source: "Manual",
    openedAt: "08:12 EAT",
  },
];

export const DASH_MAX_SCHEDULES = 50;

export interface DashboardSchedule {
  id: string;
  timeEat: string;
  countdown: string;
  symbol: string;
  side: "BUY" | "SELL" | "PAUSE";
  lots: string;
  accountId: string;
  accountLabel: string;
  trigger: "Time Window" | "Session Open" | "News Guard" | "Recurring";
  active: boolean;
}

export const initialSchedules: DashboardSchedule[] = [
  { id: "sch-01", timeEat: "17:00 EAT", countdown: "in 20m", symbol: "XAUUSD", side: "BUY", lots: "0.15", accountId: "acc-paper-main", accountLabel: "Paper Main", trigger: "Time Window", active: true },
  { id: "sch-02", timeEat: "17:30 EAT", countdown: "in 50m", symbol: "US30", side: "SELL", lots: "0.10", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", trigger: "Session Open", active: true },
  { id: "sch-03", timeEat: "18:00 EAT", countdown: "in 1h 20m", symbol: "R_10", side: "BUY", lots: "15 USD", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", trigger: "Recurring", active: true },
  { id: "sch-04", timeEat: "19:15 EAT", countdown: "in 2h 35m", symbol: "EURUSD", side: "PAUSE", lots: "Guard", accountId: "acc-paper-main", accountLabel: "All FX Rules", trigger: "News Guard", active: true },
  { id: "sch-05", timeEat: "20:00 EAT", countdown: "in 3h 20m", symbol: "BTCUSDT", side: "BUY", lots: "0.05", accountId: "acc-paper-main", accountLabel: "Paper Main", trigger: "Time Window", active: true },
  { id: "sch-06", timeEat: "21:00 EAT", countdown: "in 4h 20m", symbol: "GBPUSD", side: "SELL", lots: "0.20", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", trigger: "Time Window", active: true },
  { id: "sch-07", timeEat: "22:30 EAT", countdown: "in 5h 50m", symbol: "NAS100", side: "BUY", lots: "0.10", accountId: "acc-paper-main", accountLabel: "Paper Main", trigger: "Time Window", active: true },
  { id: "sch-08", timeEat: "00:05 EAT", countdown: "Tomorrow", symbol: "R_75", side: "BUY", lots: "20 USD", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", trigger: "Recurring", active: true },
  { id: "sch-09", timeEat: "03:00 EAT", countdown: "Tomorrow", symbol: "USDJPY", side: "BUY", lots: "0.25", accountId: "acc-paper-main", accountLabel: "Paper Main", trigger: "Session Open", active: true },
  { id: "sch-10", timeEat: "10:00 EAT", countdown: "Tomorrow", symbol: "EURUSD", side: "BUY", lots: "0.20", accountId: "acc-paper-main", accountLabel: "Paper Main", trigger: "Session Open", active: true },
  { id: "sch-11", timeEat: "11:30 EAT", countdown: "Tomorrow", symbol: "XAGUSD", side: "BUY", lots: "0.15", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", trigger: "Time Window", active: false },
  { id: "sch-12", timeEat: "15:25 EAT", countdown: "Tomorrow", symbol: "XAUUSD", side: "PAUSE", lots: "Guard", accountId: "acc-paper-main", accountLabel: "All Gold Rules", trigger: "News Guard", active: true },
];

export type RuleSourceKey = "telegram" | "webhook" | "copyfactory" | "email" | "csv" | "paste";
export type RuleSession = "any" | "london" | "newyork" | "overlap" | "asia" | "sydney" | "custom";
export interface RuleAutomationConfig {
  status: "active" | "draft" | "paused";
  description: string;
  sources: RuleSourceKey[];
  channels: string[];
  symbols: string[];
  side: "ANY" | "BUY" | "SELL";
  requireSl: boolean;
  requireTp: boolean;
  session: RuleSession;
  sessionStart: string;
  sessionEnd: string;
  minConfidence: number;
  maxSpread: number;
  marketOpenOnly: boolean;
  accountIds: string[];
  allocation: "same" | "equity";
  sizeMode: "signal" | "fixed" | "equity" | "risk";
  sizeValue: number;
  stopMode: "signal" | "scaled" | "defaults" | "none";
  stopScalePct: number;
  execution: "market" | "limit";
  slippagePips: number;
  maxTradesHour: number;
  maxOpenPositions: number;
  dailyLossPct: number;
  dedupeMinutes: number;
  quietHours: boolean;
  lastDryRunAt?: string;
  lastDryRunSummary?: string;
  updatedAt: string;
}
export interface SignalRule {
  id: string;
  name: string;
  source: "Telegram" | "TradingView" | "CopyFactory" | "Email" | "Paste";
  channel: string;
  conditionSummary: string;
  accountId: string;
  accountLabel: string;
  firedToday: number;
  lastDecision: "FILLED" | "BLOCKED" | "SKIPPED";
  lastReason: string;
  enabled: boolean;
  automation?: RuleAutomationConfig;
}

export const initialSignalRules: SignalRule[] = [
  { id: "rul-01", name: "Gold Desk VIP → Paper 0.20", source: "Telegram", channel: "Gold Desk VIP", conditionSummary: "IF XAUUSD w/ SL → 0.20 lots", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 4, lastDecision: "FILLED", lastReason: "OST-2025-00148 filled", enabled: true },
  { id: "rul-02", name: "FX Pulse London Majors", source: "Telegram", channel: "FX Pulse Africa", conditionSummary: "IF EURUSD/GBPUSD → 0.25 lots", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", firedToday: 3, lastDecision: "FILLED", lastReason: "EURUSDm 0.30 lots", enabled: true },
  { id: "rul-03", name: "TV BTC Breakout Webhook", source: "TradingView", channel: "BTC 4H Alert", conditionSummary: "IF BTCUSDT R:R ≥ 1.8 → 0.08 lots", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 2, lastDecision: "FILLED", lastReason: "Passed all 10 guards", enabled: true },
  { id: "rul-04", name: "Synthetics Scalper KE", source: "Telegram", channel: "Synthetic Signals KE", conditionSummary: "IF R_10 / R_75 → $15 stake", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", firedToday: 5, lastDecision: "SKIPPED", lastReason: "Duplicate 9m window", enabled: true },
  { id: "rul-05", name: "US30 NY Open Pullback", source: "TradingView", channel: "US30 VWAP", conditionSummary: "IF US30 16:30–19:00 EAT → 0.15 lots", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", firedToday: 2, lastDecision: "BLOCKED", lastReason: "Margin > 60% soft guard", enabled: true },
  { id: "rul-06", name: "Trend Rider Copy Filter", source: "CopyFactory", channel: "Trend Rider #2231", conditionSummary: "IF FX Major & SL ≤ 45p → mirror 0.5x", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 1, lastDecision: "FILLED", lastReason: "GBPUSD SELL mirrored", enabled: true },
  { id: "rul-07", name: "Tokyo JPY Session Rule", source: "Telegram", channel: "Asia FX Desk", conditionSummary: "IF USDJPY 02:00–06:00 EAT → 0.20 lots", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 1, lastDecision: "FILLED", lastReason: "Session window valid", enabled: false },
  { id: "rul-08", name: "NVDA Momentum Swing", source: "TradingView", channel: "US Tech 1H", conditionSummary: "IF NVDA/AAPL → 10 shares", accountId: "acc-alpaca-paper", accountLabel: "Alpaca Paper US", firedToday: 1, lastDecision: "FILLED", lastReason: "Bracket attached", enabled: true },
  { id: "rul-09", name: "ETH Trend Continuation", source: "Telegram", channel: "Crypto Room Nairobi", conditionSummary: "IF ETHUSDT → 0.40 lots", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 1, lastDecision: "FILLED", lastReason: "OST-2025-00138", enabled: true },
  { id: "rul-10", name: "Weekend Gold Blocker", source: "Telegram", channel: "All Channels", conditionSummary: "IF XAUUSD Fri > 21:00 EAT → block", accountId: "acc-paper-main", accountLabel: "All Accounts", firedToday: 0, lastDecision: "SKIPPED", lastReason: "Standby until Friday", enabled: true },
  { id: "rul-11", name: "London Open Breakout", source: "TradingView", channel: "LDN Breakouts", conditionSummary: "IF GBPUSD breakout w/ TP → 0.15 lots", accountId: "acc-paper-main", accountLabel: "Paper Main", firedToday: 2, lastDecision: "FILLED", lastReason: "Passed all guards · 2 orders", enabled: true },
  { id: "rul-12", name: "Asia Range Fade · draft", source: "Telegram", channel: "Asia FX Desk", conditionSummary: "IF USDJPY range extreme → 0.10 lots", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo Synthetics", firedToday: 0, lastDecision: "SKIPPED", lastReason: "Awaiting first dry run", enabled: false },
];

export interface CopilotProposal {
  id: string;
  title: string;
  symbol: string;
  accountId: string;
  accountLabel: string;
  environment: EnvironmentKind;
  confidence: "High · 86%" | "High · 82%" | "Medium · 74%" | "Medium · 71%";
  rationale: string;
  proposedAction: string;
  status: "pending" | "approved" | "dismissed";
}

export const initialCopilotProposals: CopilotProposal[] = [
  {
    id: "ai-01",
    title: "Lock breakeven SL on XAUUSD BUY (+$111.00)",
    symbol: "XAUUSD",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "High · 86%",
    rationale: "Position reached +55.5 pips (1.5R) ahead of US data window; journal shows +18% higher expectancy when moving SL to 2382.00.",
    proposedAction: "Modify SL 2374.00 → 2382.00 (Simulated Paper)",
    status: "pending",
  },
  {
    id: "ai-02",
    title: "Pause US30 rules on Exness Trial (Margin 62%)",
    symbol: "US30",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    environment: "demo",
    confidence: "High · 82%",
    rationale: "Margin usage crossed 60% while adapter retry backoff is active. Pausing new index entries prevents margin stress.",
    proposedAction: "Pause rule 'US30 NY Open Pullback' until margin < 45%",
    status: "pending",
  },
  {
    id: "ai-03",
    title: "Trim 50% of EURUSD SELL before ECB speaker",
    symbol: "EURUSD",
    accountId: "acc-exness-trial",
    accountLabel: "Exness MT5 Trial 1",
    environment: "demo",
    confidence: "Medium · 74%",
    rationale: "EURUSDm short is +16 pips in profit with a high-impact EUR speech in 1h 50m. Partial close requires live backend bridge.",
    proposedAction: "Stage 0.15 lot partial close (Preview — backend required)",
    status: "pending",
  },
  {
    id: "ai-04",
    title: "Add 15m pre-CPI News Guard schedule",
    symbol: "XAUUSD",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "High · 86%",
    rationale: "3 of your last 4 stopped XAUUSD trades occurred within 12 minutes of US CPI releases.",
    proposedAction: "Insert News Guard slot into Scheduler (19 / 50)",
    status: "pending",
  },
  {
    id: "ai-05",
    title: "Skip duplicate R_10 Telegram bursts",
    symbol: "R_10",
    accountId: "acc-deriv-demo",
    accountLabel: "Deriv Demo",
    environment: "demo",
    confidence: "High · 82%",
    rationale: "Synthetic Signals KE posted two identical R_10 entries 7 minutes apart; duplicate shield already caught one.",
    proposedAction: "Extend duplicate cooldown 10m → 20m",
    status: "pending",
  },
  {
    id: "ai-06",
    title: "Tighten USDJPY stop ahead of Tokyo close",
    symbol: "USDJPY",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "Medium · 71%",
    rationale: "Pair is consolidating 18 pips below entry; tightening SL reduces max risk from $48 to $26.",
    proposedAction: "Modify SL 155.40 → 155.85 (Simulated Paper)",
    status: "pending",
  },
  {
    id: "ai-07",
    title: "Cap BTCUSDT weekend lot size at 0.05",
    symbol: "BTCUSDT",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "Medium · 74%",
    rationale: "Weekend crypto spreads widen ~1.6x in your historical journal.",
    proposedAction: "Apply weekend lot cap rule",
    status: "pending",
  },
  {
    id: "ai-08",
    title: "Take partial profit on NVDA (+3.3%)",
    symbol: "NVDA",
    accountId: "acc-alpaca-paper",
    accountLabel: "Alpaca Paper US",
    environment: "paper",
    confidence: "Medium · 74%",
    rationale: "Position is approaching upper daily ATR band into NY midday.",
    proposedAction: "Sell 5 of 10 shares on Alpaca Paper",
    status: "pending",
  },
  {
    id: "ai-09",
    title: "Archive inactive Asia FX Desk rule",
    symbol: "USDJPY",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "Medium · 71%",
    rationale: "Rule has been paused for 9 days with zero triggers.",
    proposedAction: "Keep rule paused & tag for review",
    status: "pending",
  },
  {
    id: "ai-10",
    title: "Rebalance Paper Main risk-per-trade to 0.75%",
    symbol: "PORTFOLIO",
    accountId: "acc-paper-main",
    accountLabel: "Paper Main",
    environment: "paper",
    confidence: "High · 82%",
    rationale: "Paper equity grew +5.8% this month; fixed 0.75% sizing smooths drawdown.",
    proposedAction: "Stage guardrail preset update",
    status: "pending",
  },
];

export type AlertSeverity = "critical" | "warning" | "info" | "finance";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  timestamp: string;
  accountLabel: string;
  routeTo:
    | "/dashboard/accounts"
    | "/dashboard/positions"
    | "/dashboard/risk"
    | "/dashboard/deposits"
    | "/dashboard/signals"
    | "/dashboard/scheduler"
    | "/dashboard/records";
  ctaLabel: string;
  acknowledged: boolean;
}

export const initialAlerts: DashboardAlert[] = [
  {
    id: "alt-01",
    severity: "critical",
    title: "Exness MetaApi adapter reconnecting (attempt 2 of 5)",
    detail: "Snapshot age is 9s on Exness MT5 Trial 1. New automated entries targeting this account are held until heartbeat stabilizes.",
    timestamp: "2m ago",
    accountLabel: "Exness MT5 Trial 1",
    routeTo: "/dashboard/accounts",
    ctaLabel: "Inspect adapter · T-9",
    acknowledged: false,
  },
  {
    id: "alt-02",
    severity: "warning",
    title: "Margin usage reached 62.0% on Exness MT5 Trial 1",
    detail: "Soft warning threshold (60%) crossed due to US30m + EURUSDm exposure. Hard block stands at 80%.",
    timestamp: "11m ago",
    accountLabel: "Exness MT5 Trial 1",
    routeTo: "/dashboard/positions",
    ctaLabel: "Review positions · T-7",
    acknowledged: false,
  },
  {
    id: "alt-03",
    severity: "warning",
    title: "Guardrail blocked oversized US30 Telegram signal",
    detail: "Incoming signal requested 1.50 lots; Max-Lot Guard capped US30 at 0.30 lots and logged ref OST-2025-00136.",
    timestamp: "28m ago",
    accountLabel: "Paper Main",
    routeTo: "/dashboard/risk",
    ctaLabel: "Guardrail log · T-14",
    acknowledged: false,
  },
  {
    id: "alt-04",
    severity: "finance",
    title: "Demo ledger top-up reconciled: +$500.00 on Deriv Demo",
    detail: "Sandbox balance delta matched ref RDX-992014 and posted to the double-entry ledger.",
    timestamp: "1h ago",
    accountLabel: "Deriv Demo",
    routeTo: "/dashboard/deposits",
    ctaLabel: "View deposit · T-10",
    acknowledged: false,
  },
  {
    id: "alt-05",
    severity: "info",
    title: "Duplicate Signal Shield skipped repeated R_10 BUY",
    detail: "Identical entry from Synthetic Signals KE arrived 7 minutes after OST-2025-00141.",
    timestamp: "1h 18m ago",
    accountLabel: "Deriv Demo",
    routeTo: "/dashboard/signals",
    ctaLabel: "Signal Desk · T-4",
    acknowledged: false,
  },
  {
    id: "alt-06",
    severity: "info",
    title: "Scheduler slot meter at 18 / 50 (32 free slots)",
    detail: "Next timed execution fires at 17:00 EAT (XAUUSD BUY 0.15 on Paper Main).",
    timestamp: "1h 45m ago",
    accountLabel: "Paper Main",
    routeTo: "/dashboard/scheduler",
    ctaLabel: "Open Scheduler · T-6",
    acknowledged: true,
  },
  {
    id: "alt-07",
    severity: "finance",
    title: "Paper workspace starting allocation verified ($10,000.00)",
    detail: "Simulated ledger opening entry balanced with +$420.50 net realized profit since inception.",
    timestamp: "3h ago",
    accountLabel: "Paper Main",
    routeTo: "/dashboard/records",
    ctaLabel: "Open Records · T-8",
    acknowledged: true,
  },
  {
    id: "alt-08",
    severity: "warning",
    title: "High-impact US Non-Farm Payrolls in 2h 50m (19:30 EAT)",
    detail: "Consider enabling a 15-minute pre/post news guard schedule for USD & XAUUSD rules.",
    timestamp: "3h 10m ago",
    accountLabel: "All Accounts",
    routeTo: "/dashboard/scheduler",
    ctaLabel: "Schedule guard · T-6",
    acknowledged: false,
  },
  {
    id: "alt-09",
    severity: "info",
    title: "AI Co-Pilot drafted 4 new journal-backed proposals",
    detail: "Includes a breakeven stop suggestion on XAUUSD BUY (+1.5R). Awaiting your explicit approval.",
    timestamp: "4h ago",
    accountLabel: "Paper Main",
    routeTo: "/dashboard/risk",
    ctaLabel: "Review guardrails · T-14",
    acknowledged: true,
  },
  {
    id: "alt-10",
    severity: "info",
    title: "Daily loss guardrail healthy (0.42% used of 3.00% cap)",
    detail: "Aggregate realized P&L today is +$418.40 across 14 closed trades.",
    timestamp: "5h ago",
    accountLabel: "All Accounts",
    routeTo: "/dashboard/risk",
    ctaLabel: "Risk settings · T-14",
    acknowledged: true,
  },
];

export interface JournalRecord {
  id: string;
  ref: string;
  timeEat: string;
  accountId: string;
  accountLabel: string;
  broker: BrokerKey;
  origin: "Signal" | "Manual" | "Scheduled" | "Guard" | "Co-Pilot" | "Ledger";
  symbol: string;
  side: "BUY" | "SELL" | "—";
  status: "Filled" | "Closed" | "Blocked" | "Staged" | "Reconciled";
  summary: string;
  impact: string;
}

export const initialRecords: JournalRecord[] = [
  { id: "rec-01", ref: "OST-2025-00148", timeEat: "14:12", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Signal", symbol: "XAUUSD", side: "BUY", status: "Filled", summary: "0.20 lots @ 2381.40 · Gold Desk VIP", impact: "+$111.00 open" },
  { id: "rec-02", ref: "OST-2025-00147", timeEat: "13:45", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", broker: "deriv", origin: "Scheduled", symbol: "R_75", side: "BUY", status: "Filled", summary: "$25 stake multiplier @ 412,890.5", impact: "+$54.25 open" },
  { id: "rec-03", ref: "OST-2025-00146", timeEat: "13:20", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", broker: "exness", origin: "Signal", symbol: "EURUSD", side: "SELL", status: "Filled", summary: "0.30 lots EURUSDm @ 1.0858", impact: "+$48.00 open" },
  { id: "rec-04", ref: "OST-2025-00136", timeEat: "12:58", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Guard", symbol: "US30", side: "SELL", status: "Blocked", summary: "1.50 lots exceeded 0.30 lot cap", impact: "$0.00" },
  { id: "rec-05", ref: "OST-2025-00135", timeEat: "12:30", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Signal", symbol: "EURUSD", side: "BUY", status: "Closed", summary: "Closed 0.25 lots @ 1.0854 (+22p)", impact: "+$55.00" },
  { id: "rec-06", ref: "OST-2025-00134", timeEat: "11:50", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", broker: "deriv", origin: "Ledger", symbol: "USD", side: "—", status: "Reconciled", summary: "Demo cashier top-up RDX-992014", impact: "+$500.00" },
  { id: "rec-07", ref: "OST-2025-00133", timeEat: "11:15", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Scheduled", symbol: "XAUUSD", side: "BUY", status: "Closed", summary: "TP hit @ 2384.00 · 0.15 lots", impact: "+$94.50" },
  { id: "rec-08", ref: "OST-2025-00132", timeEat: "10:40", accountId: "acc-exness-trial", accountLabel: "Exness MT5 Trial 1", broker: "exness", origin: "Signal", symbol: "GBPUSD", side: "SELL", status: "Closed", summary: "Closed 0.20 lots GBPUSDm (+34p)", impact: "+$68.60" },
  { id: "rec-09", ref: "OST-2025-00131", timeEat: "09:55", accountId: "acc-alpaca-paper", accountLabel: "Alpaca Paper US", broker: "alpaca", origin: "Manual", symbol: "AAPL", side: "BUY", status: "Closed", summary: "Sold 15 shares @ $227.60", impact: "+$39.00" },
  { id: "rec-10", ref: "OST-2025-00130", timeEat: "09:12", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Signal", symbol: "BTCUSDT", side: "SELL", status: "Closed", summary: "SL hit @ 63,920 · 0.05 lots", impact: "−$24.00" },
  { id: "rec-11", ref: "OST-2025-00129", timeEat: "08:30", accountId: "acc-paper-main", accountLabel: "Paper Main", broker: "paper", origin: "Manual", symbol: "USDJPY", side: "BUY", status: "Closed", summary: "Closed 0.30 lots @ 156.18 (+29p)", impact: "+$89.00" },
  { id: "rec-12", ref: "OST-2025-00128", timeEat: "07:45", accountId: "acc-deriv-demo", accountLabel: "Deriv Demo", broker: "deriv", origin: "Scheduled", symbol: "R_10", side: "BUY", status: "Closed", summary: "Contract payout · $20 stake", impact: "+$42.05" },
];

export interface MarketSessionClock {
  id: string;
  city: string;
  region: string;
  hoursEat: string;
  localTimeSnapshot: string;
  eatSnapshot: string;
  isOpen: boolean;
  transitionNote: string;
  liquidityNote: string;
}

export const sessionClocks: MarketSessionClock[] = [
  {
    id: "ses-sydney",
    city: "Sydney",
    region: "ASX · AUD/NZD",
    hoursEat: "01:00 – 10:00 EAT",
    localTimeSnapshot: "23:40 AEDT",
    eatSnapshot: "16:40 EAT",
    isOpen: false,
    transitionNote: "Opens in 8h 20m",
    liquidityNote: "AUD & NZD pairs quiet until 01:00 EAT",
  },
  {
    id: "ses-tokyo",
    city: "Tokyo",
    region: "TSE · JPY/Gold",
    hoursEat: "03:00 – 12:00 EAT",
    localTimeSnapshot: "22:40 JST",
    eatSnapshot: "16:40 EAT",
    isOpen: false,
    transitionNote: "Opens in 10h 20m",
    liquidityNote: "Closed; JPY driven by NY yields",
  },
  {
    id: "ses-london",
    city: "London",
    region: "LSE · EUR/GBP/XAU",
    hoursEat: "10:00 – 19:00 EAT",
    localTimeSnapshot: "14:40 BST",
    eatSnapshot: "16:40 EAT",
    isOpen: true,
    transitionNote: "Closes in 2h 20m",
    liquidityNote: "Peak London–NY overlap liquidity active",
  },
  {
    id: "ses-newyork",
    city: "New York",
    region: "NYSE · USD/US30/NAS",
    hoursEat: "15:00 – 00:00 EAT",
    localTimeSnapshot: "09:40 EDT",
    eatSnapshot: "16:40 EAT",
    isOpen: true,
    transitionNote: "Closes in 7h 20m",
    liquidityNote: "Cash equities & USD macro window open",
  },
];

export interface EconomicEvent {
  id: string;
  title: string;
  currency: "USD" | "EUR" | "GBP" | "JPY" | "KES";
  impact: 2 | 3;
  timeEat: string;
  countdown: string;
  forecast: string;
  previous: string;
  affectedSymbols: string[];
  guardScheduled: boolean;
}

export const initialEconomicEvents: EconomicEvent[] = [
  { id: "ev-01", title: "US Non-Farm Payrolls (NFP)", currency: "USD", impact: 3, timeEat: "Today · 19:30 EAT", countdown: "in 2h 50m", forecast: "185K", previous: "175K", affectedSymbols: ["XAUUSD", "EURUSD", "US30"], guardScheduled: false },
  { id: "ev-02", title: "ECB President Lagarde Speech", currency: "EUR", impact: 3, timeEat: "Today · 18:30 EAT", countdown: "in 1h 50m", forecast: "—", previous: "—", affectedSymbols: ["EURUSD", "EURGBP"], guardScheduled: true },
  { id: "ev-03", title: "US ISM Services PMI", currency: "USD", impact: 3, timeEat: "Today · 21:00 EAT", countdown: "in 4h 20m", forecast: "52.6", previous: "51.4", affectedSymbols: ["USDJPY", "NAS100", "XAUUSD"], guardScheduled: false },
  { id: "ev-04", title: "US Core CPI (m/m)", currency: "USD", impact: 3, timeEat: "Tomorrow · 15:30 EAT", countdown: "in 22h 50m", forecast: "0.3%", previous: "0.4%", affectedSymbols: ["XAUUSD", "BTCUSDT", "US30"], guardScheduled: true },
  { id: "ev-05", title: "FOMC Rate Decision & Statement", currency: "USD", impact: 3, timeEat: "Wed · 21:00 EAT", countdown: "in 2d 4h", forecast: "5.25%", previous: "5.25%", affectedSymbols: ["XAUUSD", "EURUSD", "NAS100"], guardScheduled: false },
  { id: "ev-06", title: "Bank of England MPC Official Bank Rate", currency: "GBP", impact: 3, timeEat: "Thu · 14:00 EAT", countdown: "in 2d 21h", forecast: "5.00%", previous: "5.25%", affectedSymbols: ["GBPUSD", "GBPJPY"], guardScheduled: false },
  { id: "ev-07", title: "CBK Monetary Policy Committee Rate", currency: "KES", impact: 2, timeEat: "Thu · 17:00 EAT", countdown: "in 3d", forecast: "12.75%", previous: "13.00%", affectedSymbols: ["USDKES"], guardScheduled: false },
  { id: "ev-08", title: "US Initial Jobless Claims", currency: "USD", impact: 2, timeEat: "Thu · 15:30 EAT", countdown: "in 2d 23h", forecast: "218K", previous: "215K", affectedSymbols: ["XAUUSD", "US30"], guardScheduled: false },
  { id: "ev-09", title: "Bank of Japan Policy Rate", currency: "JPY", impact: 3, timeEat: "Fri · 06:00 EAT", countdown: "in 3d 13h", forecast: "0.25%", previous: "0.25%", affectedSymbols: ["USDJPY", "GBPJPY"], guardScheduled: false },
  { id: "ev-10", title: "US Retail Sales (m/m)", currency: "USD", impact: 3, timeEat: "Fri · 15:30 EAT", countdown: "in 3d 23h", forecast: "0.4%", previous: "0.1%", affectedSymbols: ["US30", "EURUSD"], guardScheduled: false },
];

export interface QuickSignalDraft {
  id: string;
  label: string;
  source: "Telegram" | "TradingView" | "CopyFactory";
  channel: string;
  rawText: string;
  symbol: string;
  side: "BUY" | "SELL";
  size: string;
  entry: string;
  sl: string;
  tp: string;
}

export const quickSignalDrafts: QuickSignalDraft[] = [
  { id: "qsd-01", label: "XAUUSD BUY · Gold Desk", source: "Telegram", channel: "Gold Desk VIP", rawText: "XAUUSD BUY @ 2386.95 | SL 2379.00 | TP 2404.00", symbol: "XAUUSD", side: "BUY", size: "0.15", entry: "2386.95", sl: "2379.00", tp: "2404.00" },
  { id: "qsd-02", label: "EURUSD SELL · FX Pulse", source: "Telegram", channel: "FX Pulse Africa", rawText: "SELL EURUSD 1.0842 | SL 1.0874 | TP 1.0785", symbol: "EURUSD", side: "SELL", size: "0.20", entry: "1.0842", sl: "1.0874", tp: "1.0785" },
  { id: "qsd-03", label: "BTCUSDT BUY · TV 4H", source: "TradingView", channel: "BTC 4H Breakout", rawText: "BTCUSDT LONG entry=64210 sl=63200 tp=66400", symbol: "BTCUSDT", side: "BUY", size: "0.05", entry: "64210.00", sl: "63200.00", tp: "66400.00" },
  { id: "qsd-04", label: "R_10 BUY · Synthetics KE", source: "Telegram", channel: "Synthetic Signals KE", rawText: "Volatility 10 Index BUY 4532.11 SL 4508 TP 4585", symbol: "R_10", side: "BUY", size: "15", entry: "4532.11", sl: "4508.00", tp: "4585.00" },
  { id: "qsd-05", label: "US30 SELL · VWAP Reject", source: "TradingView", channel: "US30 NY Session", rawText: "US30 SHORT @ 39112 | SL 39260 | TP 38820", symbol: "US30", side: "SELL", size: "0.10", entry: "39112.0", sl: "39260.0", tp: "38820.0" },
  { id: "qsd-06", label: "GBPUSD BUY · London Flow", source: "Telegram", channel: "London FX Pro", rawText: "GBPUSD BUY 1.2712 SL 1.2675 TP 1.2785", symbol: "GBPUSD", side: "BUY", size: "0.20", entry: "1.2712", sl: "1.2675", tp: "1.2785" },
  { id: "qsd-07", label: "NAS100 BUY · Tech Pulse", source: "TradingView", channel: "NAS100 15M", rawText: "NAS100 LONG 19841.7 SL 19750 TP 20020", symbol: "NAS100", side: "BUY", size: "0.10", entry: "19841.7", sl: "19750.0", tp: "20020.0" },
  { id: "qsd-08", label: "USDJPY SELL · Yield Fade", source: "CopyFactory", channel: "Swing Maker #118", rawText: "USDJPY SHORT 156.10 SL 156.65 TP 155.10", symbol: "USDJPY", side: "SELL", size: "0.20", entry: "156.10", sl: "156.65", tp: "155.10" },
  { id: "qsd-09", label: "ETHUSDT BUY · Nairobi Crypto", source: "Telegram", channel: "Crypto Room Nairobi", rawText: "ETHUSDT BUY 3120 SL 3055 TP 3265", symbol: "ETHUSDT", side: "BUY", size: "0.30", entry: "3120.00", sl: "3055.00", tp: "3265.00" },
  { id: "qsd-10", label: "R_75 SELL · Vol 75 Desk", source: "Telegram", channel: "Synthetic Signals KE", rawText: "R_75 SELL 416420 SL 419900 TP 409200", symbol: "R_75", side: "SELL", size: "20", entry: "416420.0", sl: "419900.0", tp: "409200.0" },
];
