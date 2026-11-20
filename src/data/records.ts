import { initialOpenPositions, initialRecords, initialSignalRules, tradingAccounts, type OpenPosition } from "./dashboard";
import { schedulerSchedules } from "./scheduler";
import { seedSignals } from "./signalDesk";

export type RecordSource = "Signal" | "Schedule" | "Manual" | "AI" | "Automation";
export interface TradeRecord extends Pick<OpenPosition, "ref" | "accountId" | "accountLabel" | "broker" | "environment" | "symbol" | "side" | "size" | "sizeUnit" | "entry" | "sl" | "tp"> {
  id: string;
  positionId?: string;
  openedAt: string | null;
  closedAt: string;
  exit: number;
  gross: number;
  commission: number;
  swap: number;
  risk: number | null;
  source: RecordSource;
  sourceName: string;
  sourceRef?: string;
  ruleRef?: string;
}

export interface JournalNote {
  id: string;
  tradeId?: string;
  positionId?: string;
  date: string;
  text: string;
  tags: string[];
  screenshot?: { name: string; url: string };
}

export interface StatementException {
  id: string;
  accountId: string;
  ref: string;
  kind: "Missing trade" | "P&L mismatch" | "Duplicate" | "Fee difference";
  internal?: number;
  broker?: number;
  resolution?: "Accept broker" | "Keep internal" | "Flag for review";
}

export const eatDay = (iso: string | number | Date) => new Date(new Date(iso).getTime() + 10_800_000).toISOString().slice(0, 10);
export const netPnl = (r: TradeRecord) => Math.round((r.gross + r.commission + r.swap) * 100) / 100;

const snapshot = new Date(`${eatDay(new Date())}T15:15:00+03:00`).getTime();
const fixed = (n: number) => Math.round(n * 100) / 100;
const existing = initialRecords.filter((record) => record.status === "Closed" && record.side !== "—");
const instruments = ["XAUUSD", "EURUSD", "GBPUSD", "R_10", "BTCUSDT", "USDJPY", "R_75", "AAPL"];
const results = [184.8, 126.5, -95.4, 78.2, 220.6, -110.25, 74.64, 142.8, -63.2, 198.4, -126.4, 54.38, 237.6, -78.25, 42.6, 154.73, -48.5, -140.8, 98.6, 120.5, -103.4, 211.7, 22.3];

export const initialTradeRecords: TradeRecord[] = Array.from({ length: 118 }, (_, i) => {
  const event = existing[i];
  const ago = i < 7 ? (i < 4 ? 0 : 1) : i < 64 ? Math.floor((i - 4) / 2) : 31 + (i - 64) * 2;
  const closedAt = new Date(snapshot - (ago * 1440 + (i % 7) * 41) * 60_000).toISOString();
  const symbol = event?.symbol ?? instruments[(i * 5 + Math.floor(i / 7)) % instruments.length];
  const account = tradingAccounts.find((a) => a.id === (event?.accountId ?? (symbol.startsWith("R_") ? "acc-deriv-demo" : symbol === "AAPL" ? "acc-alpaca-paper" : i % 3 === 0 ? "acc-exness-trial" : "acc-paper-main")))!;
  const sample = initialOpenPositions.find((p) => p.symbol === symbol);
  const side = event ? event.side as "BUY" | "SELL" : i % 4 < 2 ? "BUY" : "SELL";
  const net = event ? Number(event.impact.replace(/[^\d.−-]/g, "").replace("−", "-")) : results[(i * 11 + Math.floor(i / 3)) % results.length];
  const source: RecordSource = event?.origin === "Scheduled" ? "Schedule" : event?.origin === "Manual" ? "Manual" : event?.origin === "Signal" ? "Signal" : (["Signal", "Manual", "Signal", "Schedule", "Automation", "AI", "Signal", "Schedule", "Manual", "Automation"] as const)[i % 10];
  const rule = initialSignalRules[[0, 1, 2, 5][Math.floor(i / 3) % 4]];
  const schedule = schedulerSchedules.find((s) => s.symbol === symbol && s.accountId === account.id) ?? schedulerSchedules.find((s) => s.symbol === symbol) ?? schedulerSchedules[1];
  const signalPool = seedSignals.filter((s) => s.refs.includes(event?.ref ?? "") || s.order.symbol === symbol);
  const signal = signalPool.find((s) => s.refs.includes(event?.ref ?? "")) ?? signalPool[i % signalPool.length] ?? seedSignals[i % seedSignals.length];
  const signalRule = initialSignalRules.find((s) => s.channel === signal.feed);
  const entry = sample?.entry ?? (symbol === "AAPL" ? 224.8 : 1.2745);
  const precision = entry < 10 ? 5 : 2;
  const price = (n: number) => Number(n.toFixed(precision));
  const direction = side === "BUY" ? 1 : -1;
  const commission = account.broker === "deriv" ? 0 : -fixed(0.8 + (i % 8) * 0.55);
  const swap = i % 5 === 0 ? -0.85 : 0;
  return {
    id: event?.id ?? `history-${i}`, ref: event?.ref ?? `OST-2025-${String(10120 - i).padStart(5, "0")}`,
    accountId: account.id, accountLabel: account.label, broker: account.broker, environment: account.environment,
    symbol, side, size: symbol.startsWith("R_") ? 15 + 5 * (i % 4) : symbol === "AAPL" ? 10 + i % 8 : fixed(0.05 + (i % 7) * 0.05),
    sizeUnit: symbol.startsWith("R_") ? "stake" : symbol === "AAPL" ? "shares" : "lots",
    openedAt: new Date(Date.parse(closedAt) - (26 + i % 13 * 19) * 60_000).toISOString(), closedAt,
    entry, exit: price(entry * (1 + direction * net / 35_000)), sl: price(entry * (1 - direction * 0.0045)), tp: price(entry * (1 + direction * 0.009)),
    gross: fixed(net - commission - swap), commission, swap, risk: 42 + i % 9 * 18,
    source, sourceName: source === "Manual" ? "Manual ticket" : source === "AI" ? "Co-Pilot review" : source === "Schedule" ? schedule.name : source === "Automation" ? rule.name : signal.feed,
    sourceRef: source === "Schedule" ? schedule.id : source === "Automation" ? rule.id : source === "Signal" ? signal.id : undefined,
    ruleRef: source === "Automation" ? rule.id : signalRule?.id,
  };
});

const noteCopy = [
  "Waited for the retest before entering. **Keep** this checklist for the next London session.",
  "Good exit discipline. Size was within the planned risk even with a wider stop.",
  "Entered before confirmation. Next time, wait for a candle close outside the range.",
  "The scheduled leg ran as planned. Review the session window again next week.",
  "Skipped the second entry after volatility increased. No need to chase the fill.",
  "Moved the stop too early. Record the original invalidation level in the ticket.",
  "Felt pressure to recover the previous loss. Pausing helped reset the next decision.",
  "Clean breakout and pullback. Save this setup for future reference.",
  "Exit followed the plan despite a choppy close. Keep size unchanged.",
  "Reviewed the day: focus on fewer instruments during the overlap.",
];
export const initialJournalNotes: JournalNote[] = noteCopy.map((text, i) => ({
  id: `note-${i}`, tradeId: i === 9 ? undefined : initialTradeRecords[i * 3].id,
  date: eatDay(initialTradeRecords[i * 3].closedAt), text,
  tags: [["setup", "london"], ["setup", "risk"], ["mistake", "entry"], ["setup", "scheduled"], ["emotion", "discipline"], ["mistake", "exit"]][i % 6],
}));

export const initialStatementExceptions: StatementException[] = initialTradeRecords.filter((r) => r.broker !== "paper").slice(0, 10).map((r, i) => ({
  id: `exception-${i}`, accountId: r.accountId, ref: i % 4 === 3 ? `BROKER-UNMATCHED-${i}` : r.ref,
  kind: (["P&L mismatch", "Fee difference", "Duplicate", "Missing trade"] as const)[i % 4],
  internal: i % 4 === 3 ? undefined : netPnl(r), broker: fixed(netPnl(r) + (i % 4 === 2 ? 0 : i + 1.25)),
  resolution: i > 4 || r.broker === "alpaca" ? "Keep internal" : undefined,
}));
