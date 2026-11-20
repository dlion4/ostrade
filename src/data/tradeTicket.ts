// T-3 Trade Ticket typed local mock data.
// Extends src/data/dashboard.ts and src/data/markets.ts — never forks them.
import type { BrokerKey } from "./dashboard";

export type OrderType = "Market" | "Limit" | "Stop" | "Stop-Limit";
export type StopMode = "none" | "price" | "pips" | "percent" | "money";
export type TimeInForce = "GTC" | "DAY" | "IOC";
export type AllocationMode = "same" | "equity" | "custom";

export type DerivContractType =
  | "Rise/Fall"
  | "Higher/Lower"
  | "Touch/No Touch"
  | "Matches/Differs"
  | "Even/Odd"
  | "Over/Under"
  | "Multiplier"
  | "Accumulator";

export type DerivDurationUnit = "ticks" | "seconds" | "minutes" | "hours" | "days";

export interface RecentTicket {
  id: string;
  ref: string;
  timestampEat: string;
  canonical: string;
  orderType: OrderType;
  side: "BUY" | "SELL";
  baseSize: number;
  sizeUnit: "lots" | "stake" | "shares" | "units";
  entry: number;
  sl: number;
  tp: number;
  accounts: {
    accountId: string;
    label: string;
    broker: BrokerKey;
  }[];
  summary: string;
  filledCount: number;
  readyCount: number;
  blockedCount: number;
  comment: string;
}

export const initialRecentTickets: RecentTicket[] = [
  {
    id: "tkt-10",
    ref: "OST-2025-00148",
    timestampEat: "16:12 EAT",
    canonical: "XAUUSD",
    orderType: "Market",
    side: "BUY",
    baseSize: 0.2,
    sizeUnit: "lots",
    entry: 2381.4,
    sl: 2374.0,
    tp: 2402.0,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
      { accountId: "acc-exness-trial", label: "Exness MT5 Trial 1", broker: "exness" },
    ],
    summary: "1 simulated fill · 1 broker preview",
    filledCount: 1,
    readyCount: 1,
    blockedCount: 0,
    comment: "Gold Desk fanout",
  },
  {
    id: "tkt-09",
    ref: "OST-2025-00147",
    timestampEat: "15:45 EAT",
    canonical: "R_75",
    orderType: "Market",
    side: "BUY",
    baseSize: 25,
    sizeUnit: "stake",
    entry: 412890.5,
    sl: 409500.0,
    tp: 421000.0,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
      { accountId: "acc-deriv-demo", label: "Deriv Demo Synthetics", broker: "deriv" },
    ],
    summary: "1 simulated fill · 1 Deriv contract preview",
    filledCount: 1,
    readyCount: 1,
    blockedCount: 0,
    comment: "Vol75 multiplier x200",
  },
  {
    id: "tkt-08",
    ref: "OST-2025-00146",
    timestampEat: "15:20 EAT",
    canonical: "EURUSD",
    orderType: "Limit",
    side: "SELL",
    baseSize: 0.3,
    sizeUnit: "lots",
    entry: 1.0858,
    sl: 1.0885,
    tp: 1.0795,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
      { accountId: "acc-exness-trial", label: "Exness MT5 Trial 1", broker: "exness" },
    ],
    summary: "1 simulated fill · 1 broker preview",
    filledCount: 1,
    readyCount: 1,
    blockedCount: 0,
    comment: "LDN-NY overlap fade",
  },
  {
    id: "tkt-07",
    ref: "OST-2025-00145",
    timestampEat: "14:55 EAT",
    canonical: "US30",
    orderType: "Market",
    side: "SELL",
    baseSize: 0.15,
    sizeUnit: "lots",
    entry: 39065.0,
    sl: 39240.0,
    tp: 38790.0,
    accounts: [
      { accountId: "acc-exness-trial", label: "Exness MT5 Trial 1", broker: "exness" },
    ],
    summary: "1 broker preview staged",
    filledCount: 0,
    readyCount: 1,
    blockedCount: 0,
    comment: "US30 VWAP rejection",
  },
  {
    id: "tkt-06",
    ref: "OST-2025-00144",
    timestampEat: "14:10 EAT",
    canonical: "BTCUSDT",
    orderType: "Stop",
    side: "BUY",
    baseSize: 0.08,
    sizeUnit: "units",
    entry: 63680.0,
    sl: 62900.0,
    tp: 65800.0,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
    ],
    summary: "1 simulated fill",
    filledCount: 1,
    readyCount: 0,
    blockedCount: 0,
    comment: "BTC 4H breakout",
  },
  {
    id: "tkt-05",
    ref: "OST-2025-00143",
    timestampEat: "13:30 EAT",
    canonical: "NVDA",
    orderType: "Market",
    side: "BUY",
    baseSize: 10,
    sizeUnit: "shares",
    entry: 124.2,
    sl: 120.5,
    tp: 135.0,
    accounts: [
      { accountId: "acc-alpaca-paper", label: "Alpaca Paper US", broker: "alpaca" },
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
    ],
    summary: "2 simulated fills",
    filledCount: 2,
    readyCount: 0,
    blockedCount: 0,
    comment: "US Tech momentum",
  },
  {
    id: "tkt-04",
    ref: "OST-2025-00142",
    timestampEat: "12:48 EAT",
    canonical: "GBPUSD",
    orderType: "Market",
    side: "SELL",
    baseSize: 0.25,
    sizeUnit: "lots",
    entry: 1.2724,
    sl: 1.276,
    tp: 1.265,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
      { accountId: "acc-deriv-demo", label: "Deriv Demo Synthetics", broker: "deriv" },
    ],
    summary: "1 simulated fill · 1 Deriv preview",
    filledCount: 1,
    readyCount: 1,
    blockedCount: 0,
    comment: "Cable swing",
  },
  {
    id: "tkt-03",
    ref: "OST-2025-00141",
    timestampEat: "12:15 EAT",
    canonical: "R_10",
    orderType: "Market",
    side: "BUY",
    baseSize: 15,
    sizeUnit: "stake",
    entry: 4519.8,
    sl: 4495.0,
    tp: 4580.0,
    accounts: [
      { accountId: "acc-deriv-demo", label: "Deriv Demo Synthetics", broker: "deriv" },
      { accountId: "acc-exness-trial", label: "Exness MT5 Trial 1", broker: "exness" },
    ],
    summary: "1 Deriv preview · 1 unmapped blocked",
    filledCount: 0,
    readyCount: 1,
    blockedCount: 1,
    comment: "V10 synthetic entry",
  },
  {
    id: "tkt-02",
    ref: "OST-2025-00140",
    timestampEat: "11:30 EAT",
    canonical: "USDJPY",
    orderType: "Limit",
    side: "BUY",
    baseSize: 0.2,
    sizeUnit: "lots",
    entry: 156.28,
    sl: 155.4,
    tp: 157.4,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
    ],
    summary: "1 simulated fill",
    filledCount: 1,
    readyCount: 0,
    blockedCount: 0,
    comment: "JPY pullback",
  },
  {
    id: "tkt-01",
    ref: "OST-2025-00139",
    timestampEat: "10:55 EAT",
    canonical: "NAS100",
    orderType: "Market",
    side: "BUY",
    baseSize: 0.1,
    sizeUnit: "lots",
    entry: 19838.0,
    sl: 19760.0,
    tp: 19980.0,
    accounts: [
      { accountId: "acc-paper-main", label: "Paper Main", broker: "paper" },
      { accountId: "acc-exness-trial", label: "Exness MT5 Trial 1", broker: "exness" },
    ],
    summary: "1 simulated fill · 1 broker preview",
    filledCount: 1,
    readyCount: 1,
    blockedCount: 0,
    comment: "USTEC pre-NY",
  },
];

export interface TicketCapabilityRule {
  broker: BrokerKey;
  venue: string;
  orderTypes: string;
  tifSupport: TimeInForce[];
  maxCommentLen: number;
  sizingModel: string;
  notes: string;
}

export const ticketCapabilityRules: TicketCapabilityRule[] = [
  {
    broker: "paper",
    venue: "OStrade Paper",
    orderTypes: "Market · Limit · Stop · Stop-Limit",
    tifSupport: ["GTC", "DAY", "IOC"],
    maxCommentLen: 32,
    sizingModel: "Lots / Units / Shares",
    notes: "Full local fill simulation with OST-2025-XXXXX receipts and Records writes.",
  },
  {
    broker: "deriv",
    venue: "Deriv WS",
    orderTypes: "Contract Proposal → Buy",
    tifSupport: ["GTC"],
    maxCommentLen: 32,
    sizingModel: "Stake (USD) + Multiplier/Growth",
    notes: "Limits & stops expressed as contract parameters; MT5-style SL/TP patching is disabled.",
  },
  {
    broker: "exness",
    venue: "Exness MT5 (MetaApi)",
    orderTypes: "Market · Limit · Stop · Stop-Limit",
    tifSupport: ["GTC", "DAY", "IOC"],
    maxCommentLen: 32,
    sizingModel: "Lots (0.01 step) + suffix (.m/.c/.z)",
    notes: "Comment truncated safely to 32 ASCII chars; live dispatch awaits MetaApi bridge.",
  },
  {
    broker: "alpaca",
    venue: "Alpaca Paper",
    orderTypes: "Market · Limit · Stop · Stop-Limit",
    tifSupport: ["GTC", "DAY", "IOC"],
    maxCommentLen: 32,
    sizingModel: "Shares / Crypto Units",
    notes: "Bracket orders attach SL/TP at order entry; equity cash session 16:30–23:00 EAT.",
  },
];

export const DERIV_CONTRACT_TYPES: {
  id: DerivContractType;
  label: string;
  payoutHint: string;
  supportsMultiplier?: boolean;
  supportsAccumulator?: boolean;
}[] = [
  { id: "Rise/Fall", label: "Rise / Fall", payoutHint: "~195% payout on direction at expiry" },
  { id: "Higher/Lower", label: "Higher / Lower", payoutHint: "Barrier offset above or below spot" },
  { id: "Touch/No Touch", label: "Touch / No Touch", payoutHint: "Binary touch barrier within duration" },
  { id: "Matches/Differs", label: "Matches / Differs", payoutHint: "Last-digit prediction (ticks only)" },
  { id: "Even/Odd", label: "Even / Odd", payoutHint: "Last-digit parity on expiry tick" },
  { id: "Over/Under", label: "Over / Under", payoutHint: "Last-digit threshold prediction" },
  { id: "Multiplier", label: "Multiplier", payoutHint: "Leveraged move with deal cancellation", supportsMultiplier: true },
  { id: "Accumulator", label: "Accumulator", payoutHint: "Compounding growth rate within range", supportsAccumulator: true },
];
