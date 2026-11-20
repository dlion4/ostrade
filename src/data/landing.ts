// Typed local mock data for the public marketing pages (H-1..H-3).
// Shapes mirror the future REST API — extend these files, never fork them.

export type ConnectMethod = "OAuth" | "API token" | "MT5 login + server" | "API keys" | "Built-in";

export interface Broker {
  id: string;
  name: string;
  route: string; // how OStrade reaches it
  connect: ConnectMethod;
  assets: string[];
  accounts: string[];
  tone: "orange" | "cyan" | "green" | "violet" | "amber" | "slate";
  initials: string;
}

export const brokers: Broker[] = [
  { id: "paper", name: "OStrade Paper", route: "Local simulator", connect: "Built-in", assets: ["Forex", "Crypto", "Indices", "Metals"], accounts: ["Paper"], tone: "slate", initials: "OP" },
  { id: "deriv", name: "Deriv", route: "WebSocket API", connect: "OAuth", assets: ["Synthetics", "Forex", "Crypto"], accounts: ["Demo", "Real"], tone: "orange", initials: "DR" },
  { id: "exness", name: "Exness", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Metals", "Indices", "Crypto"], accounts: ["Trial", "Real"], tone: "amber", initials: "EX" },
  { id: "ctrader", name: "cTrader", route: "Open API", connect: "OAuth", assets: ["Forex", "Indices", "Commodities"], accounts: ["Demo", "Live"], tone: "cyan", initials: "cT" },
  { id: "alpaca", name: "Alpaca", route: "REST + stream", connect: "API keys", assets: ["US stocks", "Crypto"], accounts: ["Paper", "Live"], tone: "green", initials: "AL" },
  { id: "binance", name: "Binance", route: "REST + WebSocket", connect: "API keys", assets: ["Crypto spot", "Futures"], accounts: ["Testnet", "Live"], tone: "amber", initials: "BN" },
  { id: "oanda", name: "OANDA", route: "v20 REST", connect: "API token", assets: ["Forex", "Metals", "Indices"], accounts: ["Practice", "Live"], tone: "violet", initials: "OA" },
  { id: "icmarkets", name: "IC Markets", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Indices", "Metals"], accounts: ["Demo", "Live"], tone: "cyan", initials: "IC" },
  { id: "pepperstone", name: "Pepperstone", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Indices", "Commodities"], accounts: ["Demo", "Live"], tone: "violet", initials: "PS" },
  { id: "xm", name: "XM", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Metals", "Stocks CFD"], accounts: ["Demo", "Live"], tone: "orange", initials: "XM" },
  { id: "fxtm", name: "FXTM", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Metals", "Indices"], accounts: ["Demo", "Live"], tone: "green", initials: "FX" },
  { id: "tickmill", name: "Tickmill", route: "MetaApi · MT5", connect: "MT5 login + server", assets: ["Forex", "Indices", "Bonds"], accounts: ["Demo", "Live"], tone: "slate", initials: "TM" },
];

export type CapValue = "yes" | "no" | "partial";
export interface CapabilityRow {
  id: string;
  label: string;
  hint: string;
  // order: Deriv, Exness/MT5, cTrader, Alpaca, Binance, OANDA
  values: { v: CapValue; note?: string }[];
}
export const capabilityBrokers = ["Deriv", "Exness / MT5", "cTrader", "Alpaca", "Binance", "OANDA"];

const Y = { v: "yes" as const };
const N = { v: "no" as const };
export const capabilityRows: CapabilityRow[] = [
  { id: "stream", label: "Live market data", hint: "Streaming quotes from the broker feed.", values: [Y, Y, Y, Y, Y, Y] },
  { id: "market", label: "Market orders", hint: "Instant execution. On Deriv an order is a contract purchase.", values: [{ v: "yes", note: "as contract" }, Y, Y, Y, Y, Y] },
  { id: "pending", label: "Limit / stop orders", hint: "Pending orders at a chosen price.", values: [{ v: "partial", note: "as contract" }, Y, Y, Y, Y, Y] },
  { id: "modify", label: "Edit SL / TP", hint: "Change stop-loss and take-profit on an open position.", values: [N, Y, Y, { v: "yes", note: "bracket" }, Y, Y] },
  { id: "partial", label: "Partial close", hint: "Close part of a position.", values: [{ v: "partial", note: "via sell" }, Y, Y, Y, Y, Y] },
  { id: "positions", label: "Positions stream", hint: "Push updates when a position changes.", values: [Y, Y, Y, Y, Y, { v: "partial", note: "polled" }] },
  { id: "history", label: "Account history", hint: "Closed trades and balance history via API.", values: [Y, Y, Y, Y, Y, Y] },
  { id: "transfer", label: "Internal transfer", hint: "Move funds between your own accounts via API.", values: [Y, N, N, N, Y, N] },
  { id: "deposit", label: "Deposit via API", hint: "Where the API doesn't allow it, OStrade logs it in your ledger.", values: [{ v: "partial", note: "cashier link" }, N, N, { v: "partial", note: "US only" }, { v: "partial", note: "crypto" }, N] },
  { id: "withdraw", label: "Withdraw via API", hint: "Same rule as deposits: automated where permitted.", values: [{ v: "partial", note: "eligible" }, N, N, { v: "partial", note: "US only" }, { v: "partial", note: "crypto" }, N] },
  { id: "copy", label: "Copy-trading", hint: "Mirror a provider's trades.", values: [N, { v: "yes", note: "CopyFactory" }, { v: "yes", note: "cCopy" }, N, N, N] },
  { id: "demo", label: "Demo / paper account", hint: "Practice with no real money.", values: [Y, { v: "yes", note: "MT5 trial" }, Y, Y, { v: "yes", note: "testnet" }, { v: "yes", note: "practice" }] },
  { id: "247", label: "24/7 markets", hint: "Tradable on weekends.", values: [{ v: "yes", note: "synthetics" }, N, N, N, { v: "yes", note: "crypto" }, N] },
];

export interface SignalSample {
  id: string;
  source: "Telegram" | "TradingView" | "Copy provider";
  channel: string;
  raw: string[];
  symbol: string;
  side: "BUY" | "SELL";
  entry: string;
  sl: string;
  tp: string;
  lots: string;
  rr: string;
  account: string;
}

export const signalSamples: SignalSample[] = [
  { id: "s1", source: "Telegram", channel: "Gold Desk VIP", raw: ["XAUUSD BUY NOW", "Entry 2385.50", "SL 2378.00", "TP 2402.00"], symbol: "XAUUSD", side: "BUY", entry: "2385.50", sl: "2378.00", tp: "2402.00", lots: "0.10", rr: "1 : 2.2", account: "Exness MT5 · Trial" },
  { id: "s2", source: "Telegram", channel: "FX Pulse Africa", raw: ["SELL EURUSD @ 1.0842", "SL 1.0875", "TP1 1.0790"], symbol: "EURUSD", side: "SELL", entry: "1.0842", sl: "1.0875", tp: "1.0790", lots: "0.20", rr: "1 : 1.6", account: "Paper · $10,000" },
  { id: "s3", source: "TradingView", channel: "Alert · BTC breakout", raw: ["{{ticker}} long", "price={{close}}", "sl=62900 tp=66800"], symbol: "BTCUSDT", side: "BUY", entry: "64120.00", sl: "62900.00", tp: "66800.00", lots: "0.05", rr: "1 : 2.2", account: "Paper · $10,000" },
  { id: "s4", source: "Copy provider", channel: "Trend Rider #2231", raw: ["provider: Trend Rider", "GBPUSD short 0.15", "sl 1.2760 tp 1.2650"], symbol: "GBPUSD", side: "SELL", entry: "1.2712", sl: "1.2760", tp: "1.2650", lots: "0.15", rr: "1 : 1.3", account: "Exness MT5 · Trial" },
  { id: "s5", source: "Telegram", channel: "Synthetic Signals KE", raw: ["Volatility 10 Index", "BUY 4532.11", "SL 4510 / TP 4580"], symbol: "R_10", side: "BUY", entry: "4532.11", sl: "4510.00", tp: "4580.00", lots: "1.00", rr: "1 : 2.2", account: "Deriv · Demo" },
  { id: "s6", source: "TradingView", channel: "Alert · US30 pullback", raw: ["US30 SELL", "entry 39120", "stop 39280 target 38800"], symbol: "US30", side: "SELL", entry: "39120.0", sl: "39280.0", tp: "38800.0", lots: "0.10", rr: "1 : 2.0", account: "Paper · $10,000" },
  { id: "s7", source: "Telegram", channel: "Gold Desk VIP", raw: ["XAUUSD SELL LIMIT 2410", "SL 2418", "TP 2388"], symbol: "XAUUSD", side: "SELL", entry: "2410.00", sl: "2418.00", tp: "2388.00", lots: "0.10", rr: "1 : 2.8", account: "Exness MT5 · Trial" },
  { id: "s8", source: "Copy provider", channel: "Swing Maker #118", raw: ["USDJPY long 0.30", "sl 155.40 tp 157.20"], symbol: "USDJPY", side: "BUY", entry: "156.10", sl: "155.40", tp: "157.20", lots: "0.30", rr: "1 : 1.6", account: "Paper · $10,000" },
  { id: "s9", source: "Telegram", channel: "Crypto Room Nairobi", raw: ["ETHUSDT BUY", "Entry 3120", "SL 3040 TP 3300"], symbol: "ETHUSDT", side: "BUY", entry: "3120.00", sl: "3040.00", tp: "3300.00", lots: "0.50", rr: "1 : 2.3", account: "Paper · $10,000" },
  { id: "s10", source: "TradingView", channel: "Alert · AUD range", raw: ["AUDUSD short", "px 0.6640", "sl 0.6685 tp 0.6570"], symbol: "AUDUSD", side: "SELL", entry: "0.6640", sl: "0.6685", tp: "0.6570", lots: "0.25", rr: "1 : 1.6", account: "Deriv · Demo" },
];

export interface PlatformStat { id: string; value: number; prefix?: string; suffix?: string; label: string; detail: string; }
export const platformStats: PlatformStat[] = [
  { id: "brokers", value: 12, suffix: "", label: "Brokers & venues", detail: "Deriv, Exness/MT5, cTrader, Alpaca, Binance, OANDA and more." },
  { id: "slots", value: 50, suffix: "", label: "Schedule slots", detail: "Queue up to 50 timed trades, 20 at a time with bulk paste." },
  { id: "click", value: 1, suffix: "", label: "Click to execute", detail: "Review the parsed card, confirm once, done." },
  { id: "guards", value: 10, suffix: "", label: "Risk guardrails", detail: "Daily loss cap, max lots, kill-switch and more." },
];

export interface FaqItem { id: string; q: string; a: string; }
export const faqItems: FaqItem[] = [
  { id: "f1", q: "Is my money safe at the broker?", a: "OStrade never holds your funds. Your money stays with your broker. We connect through their official APIs and can only do what the connection permits. Withdrawal-capable keys are never required for trading." },
  { id: "f2", q: "Do I need to start with a real account?", a: "No. Every workspace starts on a Paper account with a simulated $10,000 balance. Switch to Deriv demo, MT5 trial or a live account whenever you like." },
  { id: "f3", q: "Which brokers need an MT5 bridge?", a: "Exness and other MT4/MT5 brokers connect through MetaApi, using your MT5 login, server name and investor/trading password. Deriv, Alpaca, Binance and OANDA use their own native APIs." },
  { id: "f4", q: "Which signal formats can OStrade read?", a: "Free-text Telegram messages, TradingView alert payloads and copy-trade provider messages. The parser pulls out symbol, side, entry, SL, TP and lot size. You can edit every field before anything is sent." },
  { id: "f5", q: "Can I schedule trades in advance?", a: "Yes. The scheduler holds up to 50 trades and accepts 20 at once by bulk paste. Each shows its slot count (n / 50) and warns you before you hit the cap." },
  { id: "f6", q: "What happens if my broker disconnects?", a: "OStrade marks the account as degraded, pauses any automation targeting it and notifies you. Nothing is retried blindly, and you resume from the Accounts page." },
  { id: "f7", q: "What do the risk guardrails do?", a: "Before every order, a guard checks your daily loss limit, max lot size, allowed symbols and trading hours. If a trade breaks a rule it is blocked and the reason is recorded." },
  { id: "f8", q: "Can I deposit and withdraw inside OStrade?", a: "Where the broker API allows it, yes. Otherwise OStrade deep-links the broker's cashier or logs the movement in your ledger with proof, so your records stay complete." },
  { id: "f9", q: "Does every action appear in my journal?", a: "Yes. Manual, signal-driven and scheduled trades, plus deposits and withdrawals, are recorded with a timestamp, account, reference such as OST-2025-00123, and status." },
  { id: "f10", q: "Is trading with OStrade risk-free?", a: "No. Trading leveraged products carries a high risk of loss. OStrade is execution and organization software, not investment advice. Paper-trade your strategy first." },
];

export interface Feature {
  id: string; title: string; blurb: string; bullets: string[]; tone: "orange" | "violet" | "cyan"; to: "/auth/signup" | "/how-it-works" | "/brokers"; cta: string;
}
export const features: Feature[] = [
  { id: "desk", title: "Signal Desk", blurb: "Paste or stream a signal from anywhere and turn it into a clean, editable order card.", bullets: ["Telegram, TradingView & copy providers", "Symbol, side, entry, SL, TP, lots parsed", "Your edits always override the signal"], tone: "orange", to: "/how-it-works", cta: "See the flow" },
  { id: "auto", title: "Automation", blurb: "Let rules, schedules and an AI co-pilot do the babysitting while you sleep.", bullets: ["Up to 50 schedules, 20 per bulk paste", "Signal rules by channel and symbol", "AI co-pilot drafts, you approve"], tone: "violet", to: "/how-it-works", cta: "How automation works" },
  { id: "hub", title: "Broker Hub", blurb: "Connect, switch and compare every account from one honest, capability-aware screen.", bullets: ["Deriv, Exness/MT5, cTrader, Alpaca, more", "Capability matrix shows what is allowed", "One toggle flips everything to paper"], tone: "cyan", to: "/brokers", cta: "Explore brokers" },
];

export interface FlowStep { id: string; title: string; text: string; }
export const flowSteps: FlowStep[] = [
  { id: "in", title: "Signal in", text: "Paste a message or receive a webhook." },
  { id: "parse", title: "Parser", text: "Extracts symbol, side, entry, SL and TP." },
  { id: "guard", title: "Risk guard", text: "Checks loss limits, lots and hours." },
  { id: "route", title: "Broker adapter", text: "Routes to Paper, Deriv or Exness/MT5." },
  { id: "fill", title: "Fill receipt", text: "Ref OST-2025-00123 lands in Records." },
];

export interface Guardrail { id: string; title: string; text: string; }
export const guardrails: Guardrail[] = [
  { id: "g1", title: "Daily loss limit", text: "Stops new orders once the day's loss reaches your cap." },
  { id: "g2", title: "Max lot size", text: "Blocks oversized orders before they reach the broker." },
  { id: "g3", title: "Symbol allow-list", text: "Only trade the instruments you have approved." },
  { id: "g4", title: "Trading hours", text: "Ignore signals that arrive outside your window." },
  { id: "g5", title: "Max open positions", text: "Cap exposure across every connected account." },
  { id: "g6", title: "Mandatory SL", text: "Reject any order that arrives without a stop-loss." },
  { id: "g7", title: "Duplicate shield", text: "Detects the same signal pasted twice." },
  { id: "g8", title: "Slippage tolerance", text: "Skips fills too far from the signalled entry." },
  { id: "g9", title: "Kill-switch", text: "One button pauses all automation, always visible." },
  { id: "g10", title: "Encrypted vault", text: "Broker credentials are stored AES-256 encrypted." },
];

export const trustItems = [
  "Deriv WebSocket API",
  "Exness via MetaApi",
  "Alpaca Paper",
  "Binance Testnet",
  "AES-256 credential vault",
  "OANDA v20",
  "cTrader Open API",
];

export interface JournalRow { ref: string; time: string; symbol: string; side: "BUY" | "SELL"; account: string; source: string; status: "Filled" | "Pending" | "Blocked" | "Closed"; pnl: string; }
export const journalRows: JournalRow[] = [
  { ref: "OST-2025-00131", time: "09:42", symbol: "XAUUSD", side: "BUY", account: "Exness · Trial", source: "Telegram", status: "Filled", pnl: "+42.10" },
  { ref: "OST-2025-00130", time: "09:15", symbol: "EURUSD", side: "SELL", account: "Paper", source: "Scheduled", status: "Closed", pnl: "+18.60" },
  { ref: "OST-2025-00129", time: "08:58", symbol: "R_10", side: "BUY", account: "Deriv · Demo", source: "Manual", status: "Closed", pnl: "−6.40" },
  { ref: "OST-2025-00128", time: "08:31", symbol: "BTCUSDT", side: "BUY", account: "Paper", source: "TradingView", status: "Filled", pnl: "+120.75" },
  { ref: "OST-2025-00127", time: "08:02", symbol: "US30", side: "SELL", account: "Paper", source: "Telegram", status: "Blocked", pnl: "—" },
  { ref: "OST-2025-00126", time: "07:47", symbol: "GBPUSD", side: "SELL", account: "Exness · Trial", source: "Copy provider", status: "Closed", pnl: "+9.20" },
  { ref: "OST-2025-00125", time: "07:20", symbol: "USDJPY", side: "BUY", account: "Paper", source: "Scheduled", status: "Pending", pnl: "—" },
  { ref: "OST-2025-00124", time: "06:55", symbol: "ETHUSDT", side: "BUY", account: "Paper", source: "Telegram", status: "Closed", pnl: "−14.30" },
  { ref: "OST-2025-00123", time: "06:30", symbol: "AUDUSD", side: "SELL", account: "Deriv · Demo", source: "Manual", status: "Closed", pnl: "+7.85" },
  { ref: "OST-2025-00122", time: "06:05", symbol: "XAUUSD", side: "SELL", account: "Exness · Trial", source: "Telegram", status: "Closed", pnl: "+31.00" },
];
