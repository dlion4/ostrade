import type { KillSwitchMode } from "./dashboard";

export const riskPolicies = [
  {
    id: "dailyLoss",
    name: "Daily loss circuit breaker",
    value: 4,
    min: 0.25,
    max: 25,
    unit: "% equity",
    detail: "Stops new orders and pauses automation. Cannot be overridden.",
  },
  {
    id: "openCount",
    name: "Maximum open positions",
    value: 12,
    min: 1,
    max: 100,
    unit: "positions",
    detail:
      "Defaults to a per-profile cap. Workspace rules can also cap the combined book.",
  },
  {
    id: "stake",
    name: "Maximum stake per trade",
    value: 200,
    min: 1,
    max: 100000,
    unit: "USD",
    detail: "Contract stake or estimated loss at the protective stop.",
  },
  {
    id: "leverage",
    name: "Maximum profile leverage",
    value: 500,
    min: 1,
    max: 1000,
    unit: "×",
    detail: "Compares configured profile leverage against the cap.",
  },
  {
    id: "symbol",
    name: "Per-symbol exposure",
    value: 20,
    min: 1,
    max: 100,
    unit: "% equity",
    detail: "Stop-risk concentration across the same instrument.",
  },
  {
    id: "asset",
    name: "Per-asset-class exposure",
    value: 35,
    min: 1,
    max: 100,
    unit: "% equity",
    detail: "Stop-risk concentration across the asset class.",
  },
  {
    id: "hourly",
    name: "Maximum trades per hour",
    value: 30,
    min: 1,
    max: 120,
    unit: "fills",
    detail: "Global rolling cap on completed Paper entries.",
  },
  {
    id: "minutes",
    name: "Daily trading session limit",
    value: 240,
    min: 15,
    max: 720,
    unit: "min",
    detail: "Caps active session minutes within an EAT day.",
  },
  {
    id: "hold",
    name: "Overnight / weekend holds",
    value: 0,
    min: 0,
    max: 2,
    unit: "policy",
    detail: "Applies to declared carry intent; no automatic liquidation.",
  },
  {
    id: "margin",
    name: "Post-trade margin ceiling",
    value: 85,
    min: 10,
    max: 95,
    unit: "% used",
    detail: "Uses the snapshot plus estimated collateral for a new order.",
  },
] as const;
export type RiskRuleId = (typeof riskPolicies)[number]["id"];
export type RiskRule = {
  id: RiskRuleId;
  scope: string;
  enabled: boolean;
  value: number;
  unit: string;
};
export const holdModes = [
  "Allow carries",
  "Block weekend holds",
  "Intraday only",
] as const;
export const defaultShields = {
  medianFactor: 3,
  duplicateSeconds: 45,
  perMinute: 6,
  signalPerMinute: 4,
  priceDeviationPct: 2,
};
export type RiskShields = typeof defaultShields;
export const shieldFields = [
  {
    key: "medianFactor",
    label: "Stake / median",
    unit: "×",
    min: 1.5,
    max: 20,
    detail: "Against the trailing 30-day sample trade-risk median.",
  },
  {
    key: "duplicateSeconds",
    label: "Duplicate window",
    unit: "sec",
    min: 5,
    max: 600,
    detail: "Identical account, instrument, side, size and prices.",
  },
  {
    key: "perMinute",
    label: "Rapid submissions",
    unit: "/ min",
    min: 1,
    max: 60,
    detail: "Counts real local submit attempts, not lab runs.",
  },
  {
    key: "signalPerMinute",
    label: "Signal storm threshold",
    unit: "/ min",
    min: 1,
    max: 60,
    detail: "Quarantines bursts on the signal submission path.",
  },
  {
    key: "priceDeviationPct",
    label: "Price sanity band",
    unit: "%",
    min: 0.1,
    max: 20,
    detail: "Checks entry against the fixed side-specific quote.",
  },
] as const;
export type RiskChannel = "Manual" | "Signal" | "Schedule" | "AI";
export type CarryIntent = "Intraday" | "Overnight" | "Weekend";
export const channelOptions: RiskChannel[] = [
  "Manual",
  "Signal",
  "Schedule",
  "AI",
];
export const carryOptions: CarryIntent[] = ["Intraday", "Overnight", "Weekend"];
export type RiskTicket = {
  accountId: string;
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  entry: number;
  sl: number;
  tp: number;
  channel: RiskChannel;
  subject?: string;
  carry?: CarryIntent;
};
export type RiskDecision = "PASS" | "BLOCK" | "OVERRIDE";
export type RiskCheck = {
  id: string;
  label: string;
  decision: RiskDecision;
  detail: string;
  overridable?: boolean;
  shield?: boolean;
};
export type RiskAudit = {
  id: string;
  at: string;
  category: "Evaluation" | "Lab" | "Shield" | "Control" | "Policy" | "Session";
  mode?: "Sample" | "Live local" | "Lab";
  rule: string;
  subject: string;
  scope: string;
  decision: RiskDecision;
  detail: string;
  reason?: string;
  ref?: string;
};
export type RiskControlKind =
  | "pause"
  | "flatten"
  | "lockdown"
  | "rearm"
  | "account-pause"
  | "account-resume"
  | "rule-pause"
  | "rule-resume";
export type RiskEngagement = {
  at: string;
  reason: string;
  command: string;
  ref?: string;
};
export type RiskReceipt = {
  id: string;
  accountId: string;
  accountLabel: string;
  attempted: number;
  closed: number;
  status: "Simulated" | "Offline" | "Needs review";
  refs: string[];
  detail: string;
};
export type RiskState = KillSwitchMode | "lockdown";
export type SessionPolicy = { reminder: number; lossStreak: number };
export const defaultSession: SessionPolicy = { reminder: 60, lossStreak: 3 };
export const sampleSessionMinutes = [84, 62, 48, 36, 29, 14, 9, 5, 0, 0, 0];
export const riskCases = [
  {
    id: "clean",
    name: "Within limits",
    symbol: "EURUSD",
    size: 0.1,
    entry: 1.08432,
    sl: 1.08032,
    tp: 1.09132,
  },
  {
    id: "stake",
    name: "Oversized stake",
    symbol: "EURUSD",
    size: 0.6,
    entry: 1.08432,
    sl: 1.07832,
    tp: 1.09132,
  },
  {
    id: "price",
    name: "Price sanity challenge",
    symbol: "EURUSD",
    size: 0.1,
    entry: 1.123,
    sl: 1.119,
    tp: 1.13,
  },
  {
    id: "market",
    name: "Missing market",
    symbol: "UNKNOWN",
    size: 0.1,
    entry: 1,
    sl: 0.99,
    tp: 1.02,
  },
] as const;
const auditSamples = [
  [
    "Maximum stake per trade",
    "EURUSD · manual ticket",
    "BLOCK",
    "Estimated $247 risk exceeded the $200 cap.",
    "Evaluation",
  ],
  [
    "Duplicate detector",
    "R_10 · Telegram signal",
    "BLOCK",
    "Matching parameters inside 45 seconds.",
    "Shield",
  ],
  [
    "Margin ceiling",
    "US30 · preflight",
    "PASS",
    "Post-trade margin stayed below the configured ceiling.",
    "Evaluation",
  ],
  [
    "Price sanity",
    "XAUUSD · manual ticket",
    "OVERRIDE",
    "Reviewed snapshot divergence.",
    "Shield",
  ],
  [
    "Signal storm",
    "Telegram burst",
    "BLOCK",
    "Quarantined burst above four submissions per minute.",
    "Shield",
  ],
  [
    "Daily session limit",
    "Paper session",
    "PASS",
    "Session headroom available.",
    "Session",
  ],
  [
    "Account capability",
    "GBPUSD · scheduler",
    "PASS",
    "Mapped account route is valid in the snapshot.",
    "Evaluation",
  ],
  [
    "Rapid-fire limiter",
    "Paper submissions",
    "BLOCK",
    "Seventh submission in the minute was blocked.",
    "Shield",
  ],
  [
    "Per-symbol exposure",
    "BTCUSDT · AI proposal",
    "PASS",
    "Stop-risk stays beneath the symbol cap.",
    "Evaluation",
  ],
  [
    "Stake / median",
    "EURUSD · signal",
    "BLOCK",
    "Requested stake was 3.4× its reference median.",
    "Shield",
  ],
  [
    "Tradable window",
    "Index · scheduler",
    "PASS",
    "Sample window open.",
    "Evaluation",
  ],
  [
    "Protective stop",
    "NZDUSD · manual ticket",
    "PASS",
    "Protective stop is on the correct side.",
    "Evaluation",
  ],
] as const;
export const seedRiskAudit: RiskAudit[] = auditSamples.map(
  ([rule, subject, decision, detail, category], i) => ({
    id: `RISK-SAMPLE-${String(i + 1).padStart(3, "0")}`,
    at: new Date(Date.now() - (i + 1) * 21 * 60_000).toISOString(),
    category,
    mode: "Sample",
    rule,
    subject,
    scope: i % 3 === 1 ? "Exness MT5 Trial 1" : "Paper Main",
    decision,
    detail,
    ...(decision === "OVERRIDE"
      ? { reason: "Sample operator verified the intended entry." }
      : {}),
  }),
);
