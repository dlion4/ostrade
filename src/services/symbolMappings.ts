import { tradingAccounts, type TradingAccount } from "@/data/dashboard";
import { marketSymbols, type MarketSymbol } from "@/data/markets";
import { latency } from "./_latency";

export type AccountSymbolOverride = { accountId: string; canonical: string; brokerSymbol: string; suffix?: string; source: "Manual" | "AI accepted" };
const key = "os-account-symbol-overrides";
let memory: AccountSymbolOverride[] = [];
export function readAccountSymbolOverrides(): AccountSymbolOverride[] {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : memory; } catch { return memory; }
}
export function mappedBrokerSymbol(symbol: MarketSymbol | undefined, account: Pick<TradingAccount,"id"|"broker">, overrides = readAccountSymbolOverrides()): string | undefined {
  return symbol ? overrides.find((m) => m.accountId === account.id && m.canonical === symbol.canonical)?.brokerSymbol ?? symbol.brokerSymbols[account.broker] : undefined;
}
export const getAccountSymbolOverrides = () => latency(readAccountSymbolOverrides());
export function saveAccountSymbolOverrides(inputs: AccountSymbolOverride[]) {
  let pending = readAccountSymbolOverrides();
  const entries = inputs.map(input => {
    const account = tradingAccounts.find(a => a.id === input.accountId);
    const symbol = marketSymbols.find(s => s.canonical === input.canonical);
    if (!symbol || !account || !symbol.brokerSymbols[account.broker]) throw new Error("Only symbols listed in this account's snapshot can be overridden.");
    const brokerSymbol = input.brokerSymbol.trim();
    if (!/^[A-Za-z0-9./_#-]{1,32}$/.test(brokerSymbol)) throw new Error("Enter a broker symbol using letters, numbers, or . / _ # - (up to 32 characters).");
    if (marketSymbols.some(s => s.canonical !== input.canonical && mappedBrokerSymbol(s, account, pending)?.toLowerCase() === brokerSymbol.toLowerCase())) throw new Error("That broker symbol already maps to another instrument on this account.");
    const entry = { ...input, brokerSymbol };
    pending = [entry, ...pending.filter(m => m.accountId !== input.accountId || m.canonical !== input.canonical)];
    return entry;
  });
  memory = pending;
  try { localStorage.setItem(key, JSON.stringify(memory)); } catch { /* session fallback */ }
  return latency(entries);
}
export async function saveAccountSymbolOverride(input: AccountSymbolOverride) {
  return (await saveAccountSymbolOverrides([input]))[0];
}
export function resetAccountSymbolOverride(accountId: string, canonical: string) {
  memory = readAccountSymbolOverrides().filter((m) => m.accountId !== accountId || m.canonical !== canonical);
  try { localStorage.setItem(key, JSON.stringify(memory)); } catch { /* session fallback */ }
  return latency({ accountId, canonical });
}
