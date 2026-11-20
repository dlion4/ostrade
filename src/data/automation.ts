// T-5 Signal Automation Engine — typed local fixtures.
// Extends the canonical signal rules in data/dashboard.ts; never duplicates them.
import {
  initialSignalRules,
  quickSignalDrafts,
  tradingAccounts,
  type BrokerKey,
  type RuleAutomationConfig,
  type RuleSession,
  type SignalRule,
  type TradingAccount,
} from "./dashboard";
import { marketSymbols } from "./markets";
import type { SourceKey } from "./signalDesk";

export const AUTOMATION_SNAPSHOT = Date.UTC(2025, 2, 14, 13, 40);
export const automationSources: { id: SourceKey; name: string; hint: string }[] = [
  { id: "telegram", name: "Telegram", hint: "Channels relayed by @OStradeBot" },
  { id: "webhook", name: "TradingView", hint: "Signed webhook payloads" },
  { id: "copyfactory", name: "CopyFactory", hint: "Provider trade stream" },
  { id: "email", name: "Email relay", hint: "Forwarded provider mail" },
  { id: "paste", name: "Paste console", hint: "Manual desk entries" },
];

export interface AutomationSignal {
  id: string;
  source: SourceKey;
  feed: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  size: number;
  confidence: number;
  spread: number;
  session: Exclude<RuleSession, "custom" | "any">;
  marketOpen: boolean;
  receivedAt: number;
  receivedLabel: string;
  outcomeR: number;
}

const label = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(",", " ·");

const SESSION_POOL: AutomationSignal["session"][] = ["london", "newyork", "overlap", "asia", "london", "sydney"];
const RESULT_POOL = [1.8, -1, 2.4, 0.65, -1, 1.2, 2.9, -1, 1.5, 0.9, -1, 2.1];
const SOURCE_POOL: SourceKey[] = ["telegram", "telegram", "webhook", "copyfactory", "telegram", "webhook", "telegram", "email", "telegram", "webhook"];

export const sampleSignals: AutomationSignal[] = Array.from({ length: 36 }, (_, i) => {
  const draft = quickSignalDrafts[i % quickSignalDrafts.length];
  const direction = i % 7 === 5 ? (draft.side === "BUY" ? "SELL" : "BUY") : draft.side;
  const entry = Number(draft.entry);
  const risk = Math.abs(entry - Number(draft.sl)) || entry * 0.004;
  const channel = draft.channel;
  const source = SOURCE_POOL[i % SOURCE_POOL.length];
  const offsetMinutes = i < 18 ? i * 46 : 2880 + (i - 18) * 2880;
  const at = new Date(AUTOMATION_SNAPSHOT - offsetMinutes * 60_000);
  const marketOpen = !["US30", "NAS100"].includes(draft.symbol) || i % 4 !== 3;
  return {
    id: `ASIG-${String(360 - i).padStart(4, "0")}`,
    source,
    feed: channel,
    symbol: draft.symbol,
    side: direction,
    entry,
    sl: direction === draft.side ? Number(draft.sl) : Number((entry + risk).toFixed(5)),
    tp: direction === draft.side ? Number(draft.tp) : Number((entry - risk * 2).toFixed(5)),
    size: Number(draft.size),
    confidence: 72 + ((i * 7) % 27),
    spread: Number((0.6 + ((i * 3) % 17) * 0.22).toFixed(2)),
    session: SESSION_POOL[i % SESSION_POOL.length],
    marketOpen,
    receivedAt: at.getTime(),
    receivedLabel: label(at),
    outcomeR: RESULT_POOL[i % RESULT_POOL.length],
  };
});

export const conditionLibrary = [
  { id: "instrument", group: "Signal", title: "Instrument allow-list", description: "Accept only instruments in the selected universe. An empty list means every mapped instrument.", example: "symbol ∈ {EURUSD, XAUUSD}", apply: { kind: "symbols" as const } },
  { id: "direction", group: "Signal", title: "Direction", description: "Match BUY, SELL, or either side. The parsed signal is authoritative.", example: "side = BUY", apply: { kind: "side" as const } },
  { id: "has-sl", group: "Risk", title: "Protective stop present", description: "Reject a signal that did not include a stop-loss. Required by the pre-trade guard.", example: "has_sl = true", apply: { kind: "requireSl" as const } },
  { id: "has-tp", group: "Signal", title: "Profit target present", description: "Only accept signals with at least one take-profit level.", example: "targets.length ≥ 1", apply: { kind: "requireTp" as const } },
  { id: "session", group: "Market", title: "Session window", description: "Evaluate only inside the selected session window. All comparisons use EAT.", example: "session = london", apply: { kind: "session" as const } },
  { id: "confidence", group: "Parser", title: "Parser confidence", description: "Only pass signals whose local parsing confidence reaches the threshold.", example: "confidence ≥ 82", apply: { kind: "confidence" as const } },
  { id: "spread", group: "Market", title: "Spread ceiling", description: "Skip when the account snapshot spread exceeds the cap in instrument points.", example: "spread ≤ 18 pts", apply: { kind: "spread" as const } },
  { id: "market-open", group: "Market", title: "Market open only", description: "Never evaluate signals for instruments outside their session window.", example: "market_open = true", apply: { kind: "marketOpen" as const } },
  { id: "channel", group: "Source", title: "Named channel", description: "Narrow the trigger to one trusted Telegram channel, webhook key, or provider.", example: "channel ∈ {Gold Desk VIP}", apply: { kind: "channels" as const } },
  { id: "dedupe", group: "Guards", title: "Duplicate window", description: "Hold the same source, instrument, side, and entry inside the configured window.", example: "dedupe_minutes = 10", apply: { kind: "dedupe" as const } },
  { id: "max-hour", group: "Guards", title: "Max trades per hour", description: "Stop evaluating a rule once it reaches its hourly execution cap.", example: "max_trades_hour = 6", apply: { kind: "maxTradesHour" as const } },
  { id: "loss-breaker", group: "Guards", title: "Daily-loss breaker", description: "Disarm the rule when its attributed daily loss reaches the configured equity percentage. This breaker cannot be overridden in the UI.", example: "daily_loss_pct = 2.5", apply: { kind: "dailyLossPct" as const } },
];

export type ConditionKind = (typeof conditionLibrary)[number]["apply"]["kind"];

// Defaults are derived from the shared rule rows so T-1 and T-5 describe one dataset.
const knownSymbols = marketSymbols.map((s) => s.canonical);
const defaultsFor = (rule: SignalRule): RuleAutomationConfig => {
  const found = knownSymbols.filter((s) => new RegExp(`(^|[^A-Z0-9_])${s}([^A-Z0-9_]|$)`).test(rule.conditionSummary));
  const sources: RuleAutomationConfig["sources"] =
    rule.source === "Telegram" ? ["telegram"] : rule.source === "TradingView" ? ["webhook"] : ["copyfactory"];
  const accounts = tradingAccounts.filter((a) => a.id === rule.accountId || (!a.connected && rule.accountLabel.includes(a.brokerName)));
  const sizeMatch = rule.conditionSummary.match(/(?:→|mirror\s+)[^\d]*([\d.]+)/);
  const isDraft = rule.id === "rul-12";
  return {
    status: isDraft ? "draft" : rule.enabled ? "active" : "paused",
    description: rule.lastReason,
    sources,
    channels: rule.channel === "All Channels" || rule.channel === "All Channels" ? [] : [rule.channel],
    symbols: found.length ? found : ["EURUSD"],
    side: "ANY",
    requireSl: true,
    requireTp: false,
    session: rule.id === "rul-05" ? "newyork" : rule.id === "rul-07" ? "asia" : "any",
    sessionStart: "10:00",
    sessionEnd: "19:00",
    minConfidence: 78,
    maxSpread: 28,
    marketOpenOnly: true,
    accountIds: accounts.length ? accounts.map((a) => a.id) : [rule.accountId],
    allocation: "same",
    sizeMode: "fixed",
    sizeValue: sizeMatch ? Math.max(0.01, Number(sizeMatch[1])) : 0.1,
    stopMode: "signal",
    stopScalePct: 100,
    execution: "market",
    slippagePips: 2,
    maxTradesHour: rule.id === "rul-04" ? 10 : 6,
    maxOpenPositions: rule.id === "rul-04" ? 8 : 12,
    dailyLossPct: 3,
    dedupeMinutes: rule.id === "rul-04" ? 20 : 10,
    quietHours: false,
    lastDryRunAt: isDraft ? undefined : "Today 09:20",
    lastDryRunSummary: isDraft ? "Not run yet" : "24 signals · 11 would execute · +4.8R",
    updatedAt: "Today 09:20",
  };
};

export const automationConfigs: Record<string, RuleAutomationConfig> = Object.fromEntries(
  initialSignalRules.map((rule) => [rule.id, rule.automation ?? defaultsFor(rule)]),
);

export const ruleSamples = initialSignalRules;

export type AuditDecision = "EXECUTED" | "SKIPPED" | "BLOCKED" | "DRY RUN" | "OPERATOR";
export interface AutomationAudit {
  id: string;
  timestamp: number;
  timestampLabel: string;
  ruleId: string;
  ruleName: string;
  signalRef: string;
  symbol: string;
  decision: AuditDecision;
  reason: string;
  orders: string[];
  latencyMs: number;
  accountLabels: string[];
}

const auditReasons: { decision: AuditDecision; reason: string }[] = [
  { decision: "EXECUTED", reason: "Passed every condition and guard." },
  { decision: "SKIPPED", reason: "Source did not match the rule trigger." },
  { decision: "EXECUTED", reason: "SL and TP both present; target account mapped." },
  { decision: "BLOCKED", reason: "Duplicate window: same entry inside 10 minutes." },
  { decision: "SKIPPED", reason: "Parser confidence below 78%." },
  { decision: "EXECUTED", reason: "Spread 2.1 pts is below the 28 pt ceiling." },
  { decision: "BLOCKED", reason: "Mandatory stop-loss missing from the source signal." },
  { decision: "SKIPPED", reason: "Outside the London session window." },
  { decision: "EXECUTED", reason: "Paper account filled; broker target held as a preview." },
  { decision: "BLOCKED", reason: "Hourly trade cap would be exceeded." },
  { decision: "SKIPPED", reason: "Instrument is not in the allow-list." },
  { decision: "EXECUTED", reason: "Risk-normalised size stayed below the stake cap." },
];

export const initialAutomationAudit: AutomationAudit[] = Array.from({ length: 36 }, (_, i) => {
  const signal = sampleSignals[i % sampleSignals.length];
  const rule = initialSignalRules[i % initialSignalRules.length];
  const outcome = auditReasons[i % auditReasons.length];
  const at = new Date(AUTOMATION_SNAPSHOT - (i < 22 ? i * 23 * 60_000 : 86_400_000 + (i - 22) * 47 * 60_000));
  return {
    id: `AUD-${String(880 - i).padStart(4, "0")}`,
    timestamp: at.getTime(),
    timestampLabel: label(at),
    ruleId: rule.id,
    ruleName: rule.name,
    signalRef: signal.id,
    symbol: signal.symbol,
    decision: outcome.decision,
    reason: outcome.reason,
    orders: outcome.decision === "EXECUTED" ? [`OST-2025-${String(140 - i).padStart(5, "0")}`] : [],
    latencyMs: 118 + ((i * 31) % 410),
    accountLabels: [rule.accountLabel],
  };
});

export const kpiTrend = [12, 18, 15, 26, 19, 31, 18];

export interface QuickSignalPreview {
  wouldExecute: boolean;
  reason: string;
}

export function defaultRuleDraft(accounts: TradingAccount[]) {
  const paper = tradingAccounts.find((a) => a.environment === "paper");
  const account = accounts.find((a) => a.connected) ?? paper;
  return {
    status: "draft" as const,
    name: "New signal rule",
    description: "Describe what this rule should protect or capture.",
    sources: ["telegram" as SourceKey],
    channels: [] as string[],
    symbols: ["XAUUSD"],
    side: "ANY" as const,
    requireSl: true,
    requireTp: false,
    session: "any" as RuleSession,
    sessionStart: "10:00",
    sessionEnd: "19:00",
    minConfidence: 72,
    maxSpread: 24,
    marketOpenOnly: true,
    accountIds: account ? [account.id] : [],
    allocation: "same" as const,
    sizeMode: "fixed" as const,
    sizeValue: 0.1,
    stopMode: "signal" as const,
    stopScalePct: 100,
    execution: "market" as const,
    slippagePips: 2,
    maxTradesHour: 6,
    maxOpenPositions: 12,
    dailyLossPct: 3,
    dedupeMinutes: 10,
    quietHours: false,
    updatedAt: "Today 16:42",
  };
}

export const brokerAccountPool = tradingAccounts;
export const selectableAccountsForRules = tradingAccounts.filter((a) => a.connected || a.environment === "live-ready");
export const brokerIconNames: Record<BrokerKey, string> = {
  paper: "Paper",
  deriv: "Deriv",
  exness: "Exness",
  ctrader: "cTrader",
  alpaca: "Alpaca",
  binance: "Binance",
  oanda: "OANDA",
  icmarkets: "IC Markets",
  pepperstone: "Pepperstone",
  xm: "XM",
};
