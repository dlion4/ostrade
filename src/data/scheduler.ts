// T-6 Trade Scheduler — typed local mock data
// Frontend-only: no broker execution, no tick simulation

export type ScheduleTrigger = "one_time" | "cron" | "interval" | "session" | "price" | "indicator";
export type ScheduleStatus = "armed" | "paused" | "completed" | "failed" | "expired";

export interface SchedulerSchedule {
  id: string;
  ref: string;
  name: string;
  trigger: ScheduleTrigger;
  triggerLabel: string;
  triggerDetail: string; // e.g. "every 15m during London" human readable
  triggerBadge: string; // short badge
  accountLabel: string;
  accountId: string;
  broker: "paper" | "deriv" | "exness" | "alpaca";
  brokerLabel: string;
  symbol: string;
  side: "BUY" | "SELL";
  size: string; // e.g. "0.10 lots" or "$15 stake"
  sl: string;
  tp: string;
  status: ScheduleStatus;
  nextFire: string; // e.g. "2025-03-14 18:00 EAT" or "Waiting: RSI 34 → <30"
  nextFireSort: number; // timestamp for sorting
  lastResult: string; // e.g. "Filled OST-2025-00142" or "Skipped: session closed"
  lastResultTone: "success" | "warn" | "neutral" | "error";
  createdAt: string;
  expiry: string;
  tags: string[];
  maxFailures: number;
  consecutiveFailures: number;
}

export const schedulerSchedules: SchedulerSchedule[] = [
  {
    id: "sch-001", ref: "OS-SCH-2101", name: "R_10 Dawn Scalp", trigger: "interval", triggerLabel: "Interval", triggerDetail: "every 15m", triggerBadge: "interval",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "R_10", side: "BUY", size: "5 USD stake", sl: "20 pts", tp: "40 pts", status: "armed", nextFire: "Today 18:00 EAT", nextFireSort: 1741965600000, lastResult: "Filled OST-2025-0091", lastResultTone: "success", createdAt: "2025-03-10", expiry: "Never", tags: ["synthetics", "scalp"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-002", ref: "OS-SCH-2102", name: "EURUSD London Open Fade", trigger: "session", triggerLabel: "Session", triggerDetail: "at London open", triggerBadge: "session",
    accountLabel: "Exness MT5 Trial 1", accountId: "acc-exness-trial", broker: "exness", brokerLabel: "Exness MT5", symbol: "EURUSD", side: "SELL", size: "0.10 lots", sl: "20 pips", tp: "40 pips", status: "armed", nextFire: "Tomorrow 10:00 EAT", nextFireSort: 1742023200000, lastResult: "Filled OST-2025-0092", lastResultTone: "success", createdAt: "2025-03-11", expiry: "2025-03-20", tags: ["london", "fade"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-003", ref: "OS-SCH-2103", name: "XAUUSD CPI Guard Short", trigger: "price", triggerLabel: "Price", triggerDetail: "if crosses_below 2380", triggerBadge: "price",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "XAUUSD", side: "SELL", size: "0.20 lots", sl: "15 pips", tp: "30 pips", status: "armed", nextFire: "Waiting: 2386.50 → < 2380", nextFireSort: 9999999999999, lastResult: "Waiting for condition", lastResultTone: "neutral", createdAt: "2025-03-12", expiry: "Never", tags: ["gold", "guard"], maxFailures: 5, consecutiveFailures: 1
  },
  {
    id: "sch-004", ref: "OS-SCH-2104", name: "NY Open US30 Reversal", trigger: "session", triggerLabel: "Session", triggerDetail: "at NY-open", triggerBadge: "session",
    accountLabel: "Exness MT5 Trial 1", accountId: "acc-exness-trial", broker: "exness", brokerLabel: "Exness MT5", symbol: "US30", side: "BUY", size: "0.10 lots", sl: "50 pts", tp: "120 pts", status: "paused", nextFire: "Paused", nextFireSort: 9999999999998, lastResult: "Paused by user", lastResultTone: "warn", createdAt: "2025-03-09", expiry: "Never", tags: ["indices", "ny"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-005", ref: "OS-SCH-2105", name: "BTCUSD Weekend Accumulator", trigger: "cron", triggerLabel: "Cron", triggerDetail: "cron 0 */2 * * *", triggerBadge: "cron",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "BTCUSDT", side: "BUY", size: "0.05 lots", sl: "400 pts", tp: "800 pts", status: "armed", nextFire: "Today 20:00 EAT", nextFireSort: 1741972800000, lastResult: "Filled OST-2025-0093", lastResultTone: "success", createdAt: "2025-03-08", expiry: "After 10 skips", tags: ["crypto", "swing"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-006", ref: "OS-SCH-2106", name: "EURUSD RSI Fade", trigger: "indicator", triggerLabel: "Indicator", triggerDetail: "if rsi14_15m < 30", triggerBadge: "indicator",
    accountLabel: "Exness MT5 Trial 1", accountId: "acc-exness-trial", broker: "exness", brokerLabel: "Exness MT5", symbol: "EURUSD", side: "BUY", size: "0.12 lots", sl: "25 pips", tp: "50 pips", status: "armed", nextFire: "Waiting: RSI 34 → < 30", nextFireSort: 9999999999999, lastResult: "Skipped: RSI 34", lastResultTone: "neutral", createdAt: "2025-03-12", expiry: "Never", tags: ["rsi", "mean-rev"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-007", ref: "OS-SCH-2107", name: "GBPJPY Asia Breakout", trigger: "interval", triggerLabel: "Interval", triggerDetail: "every 30m window 03:00-05:00", triggerBadge: "interval",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "GBPJPY", side: "BUY", size: "0.08 lots", sl: "30 pips", tp: "60 pips", status: "armed", nextFire: "Tomorrow 03:30 EAT", nextFireSort: 1741995000000, lastResult: "Filled OST-2025-0094", lastResultTone: "success", createdAt: "2025-03-07", expiry: "Never", tags: ["asia", "breakout"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-008", ref: "OS-SCH-2108", name: "Crash 1000 Hedge", trigger: "one_time", triggerLabel: "One-time", triggerDetail: "at 2025-03-14 10:00", triggerBadge: "one_time",
    accountLabel: "Deriv Demo", accountId: "acc-deriv-demo", broker: "deriv", brokerLabel: "Deriv", symbol: "CRASH1000", side: "SELL", size: "3 USD stake", sl: "—", tp: "—", status: "completed", nextFire: "Completed", nextFireSort: 9999999999997, lastResult: "Filled OST-2025-0071", lastResultTone: "success", createdAt: "2025-03-06", expiry: "One-time", tags: ["hedge"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-009", ref: "OS-SCH-2109", name: "XAUUSD London Scalp", trigger: "interval", triggerLabel: "Interval", triggerDetail: "every 15m during London", triggerBadge: "interval",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "XAUUSD", side: "BUY", size: "0.10 lots", sl: "8 pips", tp: "15 pips", status: "armed", nextFire: "Today 19:00 EAT", nextFireSort: 1741969200000, lastResult: "Failed: margin guard", lastResultTone: "error", createdAt: "2025-03-11", expiry: "Never", tags: ["scalp", "london"], maxFailures: 3, consecutiveFailures: 2
  },
  {
    id: "sch-010", ref: "OS-SCH-2110", name: "Volatility Guard GBPUSD", trigger: "indicator", triggerLabel: "Indicator", triggerDetail: "if atr_spike_1h > 1.8x", triggerBadge: "indicator",
    accountLabel: "Exness MT5 Trial 1", accountId: "acc-exness-trial", broker: "exness", brokerLabel: "Exness MT5", symbol: "GBPUSD", side: "SELL", size: "0.10 lots", sl: "35 pips", tp: "70 pips", status: "expired", nextFire: "Expired 2025-03-13", nextFireSort: 9999999999996, lastResult: "Expired: after 3 skips", lastResultTone: "warn", createdAt: "2025-03-05", expiry: "After 3 skips", tags: ["atr", "volatility"], maxFailures: 3, consecutiveFailures: 3
  },
  {
    id: "sch-011", ref: "OS-SCH-2111", name: "R_75 Accumulator Dusk", trigger: "cron", triggerLabel: "Cron", triggerDetail: "cron 30 18 * * 1-5", triggerBadge: "cron",
    accountLabel: "Deriv Demo", accountId: "acc-deriv-demo", broker: "deriv", brokerLabel: "Deriv", symbol: "R_75", side: "BUY", size: "2 USD stake", sl: "—", tp: "—", status: "armed", nextFire: "Today 18:30 EAT", nextFireSort: 1741967400000, lastResult: "Filled OST-2025-0095", lastResultTone: "success", createdAt: "2025-03-10", expiry: "Never", tags: ["synthetics", "accumulator"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-012", ref: "OS-SCH-2112", name: "ETHUSDT Dip Buy", trigger: "price", triggerLabel: "Price", triggerDetail: "if % move since open < -2.5%", triggerBadge: "price",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "ETHUSDT", side: "BUY", size: "0.15 lots", sl: "40 pips", tp: "90 pips", status: "armed", nextFire: "Waiting: -1.8% → < -2.5%", nextFireSort: 9999999999999, lastResult: "Waiting for condition", lastResultTone: "neutral", createdAt: "2025-03-12", expiry: "Never", tags: ["crypto", "dip"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-013", ref: "OS-SCH-2113", name: "USDJPY Tokyo Close Fade", trigger: "session", triggerLabel: "Session", triggerDetail: "at Asia close", triggerBadge: "session",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "USDJPY", side: "SELL", size: "0.07 lots", sl: "20 pips", tp: "40 pips", status: "failed", nextFire: "Retry in 12m", nextFireSort: 1741962000000, lastResult: "Timeout: broker no quote", lastResultTone: "error", createdAt: "2025-03-11", expiry: "Never", tags: ["tokyo", "fade"], maxFailures: 3, consecutiveFailures: 2
  },
  {
    id: "sch-014", ref: "OS-SCH-2114", name: "NAS100 Pre-Market Long", trigger: "interval", triggerLabel: "Interval", triggerDetail: "every 60m window 14:00-16:00", triggerBadge: "interval",
    accountLabel: "Paper Main", accountId: "acc-paper-main", broker: "paper", brokerLabel: "OStrade Paper", symbol: "NAS100", side: "BUY", size: "0.05 lots", sl: "60 pts", tp: "130 pts", status: "armed", nextFire: "Today 15:00 EAT", nextFireSort: 1741954800000, lastResult: "Filled OST-2025-0096", lastResultTone: "success", createdAt: "2025-03-09", expiry: "2025-03-25", tags: ["indices", "premarket"], maxFailures: 3, consecutiveFailures: 0
  },
  {
    id: "sch-015", ref: "OS-SCH-2115", name: "AUDUSD Spread Guard", trigger: "price", triggerLabel: "Price", triggerDetail: "if spread < 0.8 pips", triggerBadge: "price",
    accountLabel: "Exness MT5 Trial 1", accountId: "acc-exness-trial", broker: "exness", brokerLabel: "Exness MT5", symbol: "AUDUSD", side: "BUY", size: "0.12 lots", sl: "18 pips", tp: "36 pips", status: "armed", nextFire: "Waiting: 1.1 → < 0.8", nextFireSort: 9999999999999, lastResult: "Skipped: spread guard", lastResultTone: "warn", createdAt: "2025-03-13", expiry: "Never", tags: ["spread", "guard"], maxFailures: 3, consecutiveFailures: 0
  },
];

export interface SchedulerKpi {
  active: number;
  total: number;
  nextFiring: string;
  firedToday: number;
  successRate: string;
  failed7d: number;
  retryDepth: string;
}

export const schedulerKpis: SchedulerKpi = {
  active: 10,
  total: 50,
  nextFiring: "in 19m",
  firedToday: 24,
  successRate: "94.2%",
  failed7d: 4,
  retryDepth: "2 retries pending",
};

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "14"
  isToday: boolean;
  isWeekend: boolean;
  count: number;
  dots: { trigger: ScheduleTrigger; symbol: string }[];
}

export const calendarDays: CalendarDay[] = [
  { date: "2025-03-10", label: "10", isToday: false, isWeekend: false, count: 2, dots: [{ trigger: "interval", symbol: "XAUUSD" }, { trigger: "session", symbol: "EURUSD" }] },
  { date: "2025-03-11", label: "11", isToday: false, isWeekend: false, count: 3, dots: [{ trigger: "price", symbol: "XAUUSD" }, { trigger: "interval", symbol: "GBPJPY" }, { trigger: "indicator", symbol: "EURUSD" }] },
  { date: "2025-03-12", label: "12", isToday: false, isWeekend: false, count: 4, dots: [{ trigger: "cron", symbol: "BTCUSDT" }, { trigger: "price", symbol: "ETHUSDT" }, { trigger: "price", symbol: "AUDUSD" }, { trigger: "indicator", symbol: "GBPUSD" }] },
  { date: "2025-03-13", label: "13", isToday: false, isWeekend: false, count: 1, dots: [{ trigger: "one_time", symbol: "CRASH1000" }] },
  { date: "2025-03-14", label: "14", isToday: true, isWeekend: false, count: 6, dots: [{ trigger: "interval", symbol: "R_10" }, { trigger: "interval", symbol: "XAUUSD" }, { trigger: "cron", symbol: "R_75" }, { trigger: "session", symbol: "NAS100" }, { trigger: "interval", symbol: "XAUUSD" }, { trigger: "price", symbol: "XAUUSD" }] },
  { date: "2025-03-15", label: "15", isToday: false, isWeekend: true, count: 1, dots: [{ trigger: "cron", symbol: "BTCUSDT" }] },
  { date: "2025-03-16", label: "16", isToday: false, isWeekend: true, count: 0, dots: [] },
  // next week
  { date: "2025-03-17", label: "17", isToday: false, isWeekend: false, count: 2, dots: [{ trigger: "session", symbol: "EURUSD" }, { trigger: "interval", symbol: "NAS100" }] },
  { date: "2025-03-18", label: "18", isToday: false, isWeekend: false, count: 2, dots: [{ trigger: "interval", symbol: "GBPJPY" }, { trigger: "session", symbol: "US30" }] },
  { date: "2025-03-19", label: "19", isToday: false, isWeekend: false, count: 1, dots: [{ trigger: "price", symbol: "XAUUSD" }] },
  { date: "2025-03-20", label: "20", isToday: false, isWeekend: false, count: 2, dots: [{ trigger: "interval", symbol: "R_10" }, { trigger: "cron", symbol: "R_75" }] },
  { date: "2025-03-21", label: "21", isToday: false, isWeekend: false, count: 1, dots: [{ trigger: "interval", symbol: "R_10" }] },
  { date: "2025-03-22", label: "22", isToday: false, isWeekend: true, count: 0, dots: [] },
  { date: "2025-03-23", label: "23", isToday: false, isWeekend: true, count: 0, dots: [] },
];

export interface TimelineEvent {
  id: string;
  time: string; // e.g. "18:00"
  hour: number; // 0-24 for positioning
  symbol: string;
  side: "BUY" | "SELL";
  type: "scheduled" | "waiting";
  detail: string;
  status: "armed" | "waiting" | "failed";
}

export const timelineEvents: TimelineEvent[] = [
  { id: "tl-01", time: "15:00", hour: 15, symbol: "NAS100", side: "BUY", type: "scheduled", detail: "NAS100 Pre-Market Long", status: "armed" },
  { id: "tl-02", time: "18:00", hour: 18, symbol: "R_10", side: "BUY", type: "scheduled", detail: "R_10 Dawn Scalp", status: "armed" },
  { id: "tl-03", time: "18:30", hour: 18.5, symbol: "R_75", side: "BUY", type: "scheduled", detail: "R_75 Accumulator Dusk", status: "armed" },
  { id: "tl-04", time: "19:00", hour: 19, symbol: "XAUUSD", side: "BUY", type: "scheduled", detail: "XAUUSD London Scalp", status: "armed" },
  { id: "tl-05", time: "20:00", hour: 20, symbol: "BTCUSDT", side: "BUY", type: "scheduled", detail: "BTC Weekend Accum", status: "armed" },
  { id: "tl-06", time: "21:30", hour: 21.5, symbol: "EURUSD", side: "SELL", type: "waiting", detail: "RSI 34 → < 30", status: "waiting" },
  { id: "tl-07", time: "—", hour: 22, symbol: "XAUUSD", side: "SELL", type: "waiting", detail: "2386.5 → < 2380", status: "waiting" },
  { id: "tl-08", time: "02:42", hour: 2.7, symbol: "USDJPY", side: "SELL", type: "scheduled", detail: "Tokyo Close Fade — retry pending", status: "failed" },
];

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  firedAt: string;
  conditionSnapshot: string;
  orderRef: string;
  brokerResponse: string;
  brokerTone: "success" | "error" | "warn" | "neutral";
  retryCount: number;
  pnl: string;
  pnlTone: "up" | "down" | "neutral";
}

export const scheduleExecutions: ScheduleExecution[] = [
  { id: "exe-01", scheduleId: "sch-001", firedAt: "2025-03-14 16:42 EAT", conditionSnapshot: "Interval elapsed · London session", orderRef: "OST-2025-0091", brokerResponse: "Filled @ 4532.11", brokerTone: "success", retryCount: 0, pnl: "+$4.20", pnlTone: "up" },
  { id: "exe-02", scheduleId: "sch-001", firedAt: "2025-03-14 16:27 EAT", conditionSnapshot: "Interval elapsed · London session", orderRef: "OST-2025-0089", brokerResponse: "Filled @ 4529.40", brokerTone: "success", retryCount: 0, pnl: "+$2.80", pnlTone: "up" },
  { id: "exe-03", scheduleId: "sch-001", firedAt: "2025-03-14 16:12 EAT", conditionSnapshot: "Interval elapsed · London session", orderRef: "OST-2025-0082", brokerResponse: "Rejected: max lot guard", brokerTone: "error", retryCount: 1, pnl: "$0.00", pnlTone: "neutral" },
  { id: "exe-04", scheduleId: "sch-001", firedAt: "2025-03-14 15:58 EAT", conditionSnapshot: "Interval elapsed · London session", orderRef: "OST-2025-0079", brokerResponse: "Filled @ 4525.90", brokerTone: "success", retryCount: 0, pnl: "-$1.10", pnlTone: "down" },
  { id: "exe-05", scheduleId: "sch-001", firedAt: "2025-03-14 15:43 EAT", conditionSnapshot: "Interval elapsed · London session", orderRef: "OST-2025-0075", brokerResponse: "Filled @ 4521.10", brokerTone: "success", retryCount: 0, pnl: "+$6.50", pnlTone: "up" },
  { id: "exe-06", scheduleId: "sch-001", firedAt: "2025-03-14 15:28 EAT", conditionSnapshot: "Missed: outside London window", orderRef: "—", brokerResponse: "Skipped · session closed", brokerTone: "warn", retryCount: 0, pnl: "$0.00", pnlTone: "neutral" },
  { id: "exe-07", scheduleId: "sch-009", firedAt: "2025-03-14 14:05 EAT", conditionSnapshot: "RSI 38.2 — guard passed", orderRef: "OST-2025-0070", brokerResponse: "Filled @ 2383.10", brokerTone: "success", retryCount: 0, pnl: "+$12.40", pnlTone: "up" },
  { id: "exe-08", scheduleId: "sch-013", firedAt: "2025-03-14 13:00 EAT", conditionSnapshot: "Asia close trigger", orderRef: "OST-2025-0069", brokerResponse: "Timeout: no quote", brokerTone: "error", retryCount: 2, pnl: "$0.00", pnlTone: "neutral" },
];

export const bulkPasteExamples = [
  "R_10 RISE 5usd ticks 3 every 15min london",
  "EURUSD BUY 0.1 SL 20p TP 40p at NY-open",
  "XAUUSD SELL 0.2 if crosses_below 2380",
  "BTCUSDT BUY 0.05 if rsi14_15m < 30",
  "US30 BUY 0.1 SL 30p TP 60p cron 0 9 * * 1-5",
];

export const scheduleTemplates = [
  { id: "tpl-01", name: "London Open Breakout", icon: "sunrise", desc: "Buy EURUSD at London open with tight SL", trigger: "session" },
  { id: "tpl-02", name: "NY Volatility Guard", icon: "shield", desc: "Pause XAUUSD 15m around CPI", trigger: "price" },
  { id: "tpl-03", name: "RSI Mean Reversion", icon: "activity", desc: "Buy EURUSD when RSI(14) < 30", trigger: "indicator" },
  { id: "tpl-04", name: "Synthetic Accumulator", icon: "zap", desc: "R_75 accumulator every evening", trigger: "cron" },
];
