import { eatDay, netPnl, type TradeRecord } from "@/services/records";

export const usd = (n: number, signed = false, digits = 2) => `${n < 0 ? "−" : n > 0 && signed ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const tone = (n: number) => n > 0 ? "os-rec-up" : n < 0 ? "os-rec-down" : "os-rec-muted";
export const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Africa/Nairobi" });
export const eatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
export const ratio = (r: TradeRecord) => r.risk ? netPnl(r) / r.risk : null;
export const duration = (r: TradeRecord) => r.openedAt ? Math.max(0, Math.round((Date.parse(r.closedAt) - Date.parse(r.openedAt)) / 60_000)) : null;
export const price = (value: number) => value ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "—";
export const brokerName: Record<string, string> = { paper: "Paper", exness: "Exness MT5", deriv: "Deriv", alpaca: "Alpaca", binance: "Binance", oanda: "OANDA" };

export function summarize(rows: TradeRecord[]) {
  let positive = 0, loss = 0, wins = 0, losses = 0, rSum = 0, rCount = 0;
  for (const r of rows) {
    const net = netPnl(r);
    if (net > 0) { positive += net; wins++; }
    if (net < 0) { loss -= net; losses++; }
    const rr = ratio(r);
    if (rr !== null) { rCount++; rSum += rr; }
  }
  return { net: positive - loss, wins, losses, winRate: rows.length ? wins / rows.length * 100 : 0, profitFactor: loss ? positive / loss : positive ? Infinity : null, avgR: rCount ? rSum / rCount : null };
}

export function dailyTotals(rows: TradeRecord[]) {
  const days = new Map<string, { date: string; net: number; count: number }>();
  for (const row of rows) {
    const date = eatDay(row.closedAt);
    const day = days.get(date) ?? { date, net: 0, count: 0 };
    day.net += netPnl(row); day.count++;
    days.set(date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
