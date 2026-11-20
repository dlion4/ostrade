// H-3 How It Works — mock datasets. Extends the shared landing dataset for samples.

export interface PipelineStage {
  id: string;
  title: string;
  ms: number; // cumulative latency budget
  input: string;
  output: string;
  detail: string;
  icon: "inbox" | "split" | "shield" | "route" | "zap" | "book";
}
export const pipelineStages: PipelineStage[] = [
  { id: "ingest", title: "Ingest", ms: 0, input: "Pasted text or webhook", output: "Raw signal payload", detail: "Telegram message, TradingView alert or copy-provider entry arrives exactly as written.", icon: "inbox" },
  { id: "parse", title: "Parse", ms: 35, input: "Raw signal payload", output: "Draft order object", detail: "Symbol, side, entry, SL, TP and lots are extracted. Anything unclear is flagged, never guessed silently.", icon: "split" },
  { id: "guard", title: "Guard", ms: 70, input: "Draft order object", output: "Approved or blocked", detail: "Ten guardrails run: loss limits, lot caps, allow-lists, hours, duplicate and slippage checks.", icon: "shield" },
  { id: "route", title: "Route", ms: 120, input: "Approved order", output: "Broker instruction", detail: "The active account's adapter translates the order: contract for Deriv, lots for MT5, units for OANDA.", icon: "route" },
  { id: "execute", title: "Execute", ms: 310, input: "Broker instruction", output: "Fill or rejection", detail: "Sent once, with an explicit confirmation for manual trades. Rejections are surfaced with the broker's reason.", icon: "zap" },
  { id: "record", title: "Record", ms: 340, input: "Fill or rejection", output: "Journal entry", detail: "Reference OST-2025-XXXXX, timestamp, account and status land in Records for analytics.", icon: "book" },
];

export interface AnatomyMarker { id: number; title: string; text: string; }
export const anatomyMarkers: AnatomyMarker[] = [
  { id: 1, title: "Symbol & side", text: "Parsed from the signal and normalised to the broker's instrument before anything runs." },
  { id: 2, title: "Entry, SL and TP", text: "Every field is editable. Your manual edits always win over the signal's numbers." },
  { id: 3, title: "Lots & risk readout", text: "Position size with estimated risk percentage and distance to the stop, checked against guardrails." },
  { id: 4, title: "Account picker", text: "Paper, Deriv or Exness/MT5 — the same card routes to whichever account is active or chosen." },
  { id: 5, title: "Explicit confirm", text: "Nothing is sent on paste. Manual trades need one deliberate confirmation; rules and schedules say so upfront." },
  { id: 6, title: "Reference & status", text: "Filled orders get a ref like OST-2025-00123 and a journal entry you can trace back to the original signal." },
];

export interface AutomationModel {
  id: "rules" | "schedules" | "copilot";
  name: string;
  tagline: string;
  blurb: string;
  points: string[];
  tone: "orange" | "cyan" | "violet";
}
export const automationModels: AutomationModel[] = [
  {
    id: "rules", name: "Signal rules", tagline: "If a channel posts it, run it.",
    blurb: "Attach sizing, account and symbol filters to the channels you trust. A rule turns a pasted habit into a standing instruction.",
    points: ["Per-channel allow-lists and symbol filters", "Sizing overrides per rule or per account", "One-click pause per rule, global kill-switch above all"],
    tone: "orange",
  },
  {
    id: "schedules", name: "Schedules", tagline: "Queue it, forget it.",
    blurb: "Line up timed trades for news windows and sessions. Paste 20 at once, watch the slot meter, and let the queue do the waiting.",
    points: ["Up to 50 slots, 20 at a time by bulk paste", "Per-trade time window with retry policy", "Every queued trade shows n / 50 and warns before the cap"],
    tone: "cyan",
  },
  {
    id: "copilot", name: "AI co-pilot", tagline: "Drafts, never decides.",
    blurb: "The co-pilot reads your journal and drafts suggestions — close half, tighten a stop, skip a duplicate. You approve every action.",
    points: ["Suggestions carry confidence labels and reasoning", "Approval required for every proposed action", "Nothing executes while you are away"],
    tone: "violet",
  },
];

export const SCHEDULER_MAX = 50;
export const SCHEDULER_BULK = 20;

export interface ScheduledItem { id: string; symbol: string; side: "BUY" | "SELL"; at: string; lots: string; account: string; }
export const scheduledInitial: ScheduledItem[] = [
  { id: "q01", symbol: "XAUUSD", side: "BUY", at: "Mon 09:30", lots: "0.10", account: "Exness · Trial" },
  { id: "q02", symbol: "EURUSD", side: "SELL", at: "Mon 10:00", lots: "0.20", account: "Paper" },
  { id: "q03", symbol: "US30", side: "SELL", at: "Mon 15:30", lots: "0.10", account: "Paper" },
  { id: "q04", symbol: "R_10", side: "BUY", at: "Mon 18:00", lots: "1.00", account: "Deriv · Demo" },
  { id: "q05", symbol: "BTCUSDT", side: "BUY", at: "Tue 02:00", lots: "0.05", account: "Paper" },
  { id: "q06", symbol: "GBPUSD", side: "SELL", at: "Tue 09:00", lots: "0.15", account: "Exness · Trial" },
  { id: "q07", symbol: "XAGUSD", side: "BUY", at: "Tue 13:45", lots: "0.20", account: "Paper" },
  { id: "q08", symbol: "NAS100", side: "BUY", at: "Tue 15:30", lots: "0.10", account: "Paper" },
  { id: "q09", symbol: "USDJPY", side: "BUY", at: "Wed 01:00", lots: "0.30", account: "Paper" },
  { id: "q10", symbol: "ETHUSDT", side: "BUY", at: "Wed 08:00", lots: "0.50", account: "Paper" },
  { id: "q11", symbol: "AUDUSD", side: "SELL", at: "Wed 11:30", lots: "0.25", account: "Deriv · Demo" },
  { id: "q12", symbol: "XAUUSD", side: "SELL", at: "Wed 14:00", lots: "0.10", account: "Exness · Trial" },
  { id: "q13", symbol: "R_75", side: "BUY", at: "Thu 06:00", lots: "0.50", account: "Deriv · Demo" },
  { id: "q14", symbol: "US30", side: "BUY", at: "Thu 15:30", lots: "0.05", account: "Paper" },
  { id: "q15", symbol: "EURUSD", side: "BUY", at: "Fri 09:00", lots: "0.20", account: "Paper" },
  { id: "q16", symbol: "GBPJPY", side: "SELL", at: "Fri 10:30", lots: "0.10", account: "Paper" },
  { id: "q17", symbol: "XAUUSD", side: "BUY", at: "Fri 13:30", lots: "0.05", account: "Exness · Trial" },
  { id: "q18", symbol: "BTCUSDT", side: "SELL", at: "Sat 00:00", lots: "0.02", account: "Paper" },
];

export const schedulePool: Omit<ScheduledItem, "id">[] = [
  { symbol: "XAUUSD", side: "BUY", at: "Sat 08:00", lots: "0.10", account: "Paper" },
  { symbol: "NAS100", side: "SELL", at: "Sat 14:00", lots: "0.10", account: "Paper" },
  { symbol: "EURUSD", side: "SELL", at: "Sun 22:00", lots: "0.15", account: "Paper" },
  { symbol: "R_10", side: "SELL", at: "Mon 03:00", lots: "1.00", account: "Deriv · Demo" },
  { symbol: "GBPUSD", side: "BUY", at: "Mon 08:00", lots: "0.10", account: "Exness · Trial" },
  { symbol: "US30", side: "BUY", at: "Mon 14:30", lots: "0.05", account: "Paper" },
  { symbol: "XAGUSD", side: "SELL", at: "Mon 16:00", lots: "0.20", account: "Paper" },
  { symbol: "ETHUSDT", side: "SELL", at: "Tue 04:00", lots: "0.40", account: "Paper" },
  { symbol: "USDJPY", side: "SELL", at: "Tue 07:30", lots: "0.20", account: "Paper" },
  { symbol: "AUDUSD", side: "BUY", at: "Tue 23:00", lots: "0.25", account: "Deriv · Demo" },
];

export interface FinanceLane {
  id: "api" | "deep-link" | "manual";
  name: string;
  when: string;
  steps: { title: string; text: string }[];
  examples: string[];
}
export const financeLanes: FinanceLane[] = [
  {
    id: "api", name: "Automated API flow", when: "The broker API permits the movement",
    steps: [
      { title: "Initiate in-app", text: "Amount, account and reference stay inside OStrade." },
      { title: "Broker API call", text: "The adapter sends the instruction over the official API." },
      { title: "Receipt stored", text: "Confirmation and reference are attached to the entry." },
      { title: "Ledger credit", text: "Balance updates and the entry closes automatically." },
    ],
    examples: ["Deriv (eligible)", "Alpaca (US)", "Binance (crypto)"],
  },
  {
    id: "deep-link", name: "Deep-link flow", when: "The broker uses a hosted cashier",
    steps: [
      { title: "OStrade generates the link", text: "A pre-filled cashier URL for the exact amount." },
      { title: "You complete it at the broker", text: "Payment happens on the broker's own page." },
      { title: "Completion tracked", text: "Balance delta plus transaction stream confirm it." },
      { title: "Ledger reconciles", text: "The entry closes without manual typing." },
    ],
    examples: ["Deriv cashier", "Payment agent · M-Pesa"],
  },
  {
    id: "manual", name: "Manual rail, automated ledger", when: "The broker API says no",
    steps: [
      { title: "You move funds at the broker", text: "Bank, card or wallet — whatever the broker offers." },
      { title: "Upload proof", text: "Screenshot of the receipt or the transaction hash." },
      { title: "Balance match", text: "OStrade watches for the credit and pairs it to the entry." },
      { title: "Ledger closes", text: "Timestamp, amount and proof stay together in Records." },
    ],
    examples: ["Exness / MT5", "cTrader", "OANDA"],
  },
];

export interface GuardScenario {
  id: string;
  name: string;
  order: string;
  checks: { label: string; pass: boolean; note?: string }[];
  blocked: boolean;
  verdict: string;
  record: string;
}
export const guardScenarios: GuardScenario[] = [
  {
    id: "clean", name: "Clean signal", order: "XAUUSD · BUY · 0.10 · SL 2378.00",
    checks: [
      { label: "Daily loss limit", pass: true },
      { label: "Max lot size", pass: true },
      { label: "Symbol allow-list", pass: true },
      { label: "Trading hours", pass: true },
      { label: "Mandatory SL", pass: true },
      { label: "Duplicate shield", pass: true },
    ],
    blocked: false, verdict: "Cleared — routed to the broker adapter.", record: "OST-2025-00141 · Filled",
  },
  {
    id: "oversize", name: "Oversized lots", order: "US30 · SELL · 5.00 · SL 39280",
    checks: [
      { label: "Daily loss limit", pass: true },
      { label: "Max lot size", pass: false, note: "5.00 exceeds the 1.00 cap for US30" },
      { label: "Symbol allow-list", pass: true },
      { label: "Trading hours", pass: true },
      { label: "Mandatory SL", pass: true },
      { label: "Duplicate shield", pass: true },
    ],
    blocked: true, verdict: "Blocked — order never reached the broker.", record: "OST-2025-00142 · Blocked · reason kept",
  },
  {
    id: "nosl", name: "Missing stop-loss", order: "BTCUSDT · BUY · 0.05 · SL —",
    checks: [
      { label: "Daily loss limit", pass: true },
      { label: "Max lot size", pass: true },
      { label: "Symbol allow-list", pass: true },
      { label: "Trading hours", pass: true },
      { label: "Mandatory SL", pass: false, note: "The signal arrived without a stop" },
      { label: "Duplicate shield", pass: true },
    ],
    blocked: true, verdict: "Blocked — add a stop, then resubmit.", record: "OST-2025-00143 · Blocked · reason kept",
  },
  {
    id: "hours", name: "Off-hours signal", order: "EURUSD · SELL · 0.20 · Sun 23:10",
    checks: [
      { label: "Daily loss limit", pass: true },
      { label: "Max lot size", pass: true },
      { label: "Symbol allow-list", pass: true },
      { label: "Trading hours", pass: false, note: "FX window opens Mon 00:05 server time" },
      { label: "Mandatory SL", pass: true },
      { label: "Duplicate shield", pass: true },
    ],
    blocked: true, verdict: "Held — queued for the next open window.", record: "OST-2025-00144 · Held · window rule",
  },
];

export interface RecordState { id: string; label: string; detail: string; ref: string; }
export const recordStates: RecordState[] = [
  { id: "submitted", label: "Submitted", detail: "The order leaves OStrade and waits at the venue.", ref: "pending" },
  { id: "filled", label: "Filled", detail: "Reference issued the moment the fill lands.", ref: "OST-2025-00145" },
  { id: "managed", label: "Managed", detail: "SL/TP edits and partial closes are logged as events.", ref: "edited ×2" },
  { id: "closed", label: "Closed", detail: "Final P&L is booked against the account balance.", ref: "+42.10" },
  { id: "journal", label: "Journal", detail: "The full story is searchable and feeds analytics.", ref: "indexed" },
];

export interface DisconnectState { id: string; label: string; text: string; tone: "up" | "warn" | "down" | "quote"; }
export const disconnectSequence: DisconnectState[] = [
  { id: "healthy", label: "Healthy", text: "Adapter pings are green and streams are flowing.", tone: "up" },
  { id: "degraded", label: "Degraded", text: "A ping times out; the account is flagged within seconds.", tone: "warn" },
  { id: "paused", label: "Automation paused", text: "Rules and schedules targeting that account stop. Nothing retries blindly.", tone: "down" },
  { id: "resume", label: "You resume", text: "Fix the credential or network, reconnect from Accounts, unpause.", tone: "quote" },
];

export interface HowFaq { id: string; q: string; a: string; }
export const howFaqs: HowFaq[] = [
  { id: "hf1", q: "Is my money safe at the broker?", a: "OStrade never holds funds. Your balance stays with your broker, and OStrade connects through official APIs using only the access you grant. Trade-only credentials are recommended everywhere they are offered." },
  { id: "hf2", q: "Which brokers need the MT5 bridge?", a: "Exness and other MetaTrader brokers connect through MetaApi using your MT5 login, exact server name and trading password. Deriv, cTrader, Alpaca, Binance and OANDA use their own native APIs." },
  { id: "hf3", q: "Can I really run 20 schedules at once?", a: "Yes. Bulk paste accepts 20 trades in one action, and the scheduler holds up to 50. The slot meter always shows n / 50, and overflow is blocked with a clear message — never silently dropped." },
  { id: "hf4", q: "What happens if my broker disconnects?", a: "The account flips to degraded, automation targeting it pauses, and you get a notification. Nothing retries blindly. You reconnect from the Accounts page and unpause when ready." },
  { id: "hf5", q: "Paper versus live — what actually differs?", a: "Paper simulates fills locally so you can learn the workflow risk-free. Live routes through the real broker API, with real spreads, slippage and rejections. Guardrails and confirmations apply to both." },
  { id: "hf6", q: "Can I control OStrade from Telegram?", a: "Ingestion from Telegram is a first-class flow: paste a message or wire a channel, and the parser handles free-text signals. Execution still respects your rules, guardrails and account selection." },
  { id: "hf7", q: "How are references parsed and issued?", a: "Every submitted order gets a reference in the OST-2025-XXXXX format at submission. The reference follows the order through fill, edits, close and journal, so any entry traces back to the original signal." },
  { id: "hf8", q: "What do the risk guards actually check?", a: "Daily loss limit, max lot size, symbol allow-list, trading hours, mandatory stop-loss, duplicate signals and slippage tolerance. A failed check blocks or holds the order and records the reason." },
];

export interface CopilotSuggestion { id: string; title: string; reason: string; confidence: "High" | "Medium"; }
export const copilotSuggestions: CopilotSuggestion[] = [
  { id: "c1", title: "Close 50% of XAUUSD BUY", reason: "Price reached 1:2 R:R — your journal wins more when you bank half here.", confidence: "High" },
  { id: "c2", title: "Skip duplicate EURUSD signal", reason: "Same channel posted the same setup 11 minutes ago.", confidence: "High" },
  { id: "c3", title: "Tighten US30 stop to breakeven", reason: "Position is +38 pips and your win rate drops after retracements past 30.", confidence: "Medium" },
];
