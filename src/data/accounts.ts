import { adapterSnapshots, tradingAccounts, type BrokerKey } from "./dashboard";
import { brokers, capabilityRows, type CapValue } from "./landing";

const supported = new Set(adapterSnapshots.map((a) => a.broker));
const matrixOrder = ["deriv", "exness", "ctrader", "alpaca", "binance", "oanda"];
export const hubProviders = brokers.filter((b) => supported.has(b.id as BrokerKey)).map((b) => ({ ...b, id: b.id as BrokerKey }));
export type HubProvider = (typeof hubProviders)[number];
export const readyMessage = "Ready — executes when the backend is connected";
export type Capability = { id: string; label: string; v: CapValue; note?: string };
export function providerCapabilities(broker: BrokerKey): Capability[] {
  const index = matrixOrder.indexOf(broker);
  return capabilityRows.filter((r) => ["market", "modify", "deposit", "withdraw", "transfer", "history"].includes(r.id)).map(({ id, label, values }) => ({
    id, label, ...(index >= 0 ? values[index] : { v: (id === "market" || id === "modify" || (id === "history" && broker === "paper")) ? "yes" : "no", note: broker === "paper" ? "local engine" : id === "history" ? "preview only" : undefined }),
  }));
}
export type AccountEvent = "Workspace loaded" | "Diagnostics" | "Reconnect requested" | "Symbol refresh" | "Mapping updated" | "History sync" | "Setup preview" | "Paper created" | "Permissions reviewed" | "Credential rotation" | "Disconnect requested" | "Routing changed";
export interface AccountAudit { id: string; at: string; accountId?: string; broker: BrokerKey; event: AccountEvent; outcome: "Local" | "Snapshot" | "Ready"; detail: string }
const base = Date.parse("2026-11-20T09:15:00+03:00");
export const initialAccountAudit: AccountAudit[] = tradingAccounts.map((account, i) => ({ id: `acct-audit-${i}`, at: new Date(base - i * 29 * 60_000).toISOString(), accountId: account.id, broker: account.broker,
  event: account.connected ? "Workspace loaded" : i % 2 ? "Permissions reviewed" : "Setup preview", outcome: account.broker === "paper" ? "Local" : "Snapshot",
  detail: account.connected ? (account.broker === "paper" ? "Local simulation account loaded." : `Static ${account.environment === "demo" ? "demo" : "paper"} snapshot loaded. No broker session opened.`) : "Adapter configuration fixture; external account access not authorized.",
}));

export interface AccountFinanceEntry { id: string; accountId: string; kind: "Deposit" | "Withdrawal" | "Transfer"; amount: number; currency: string; rail: string; at: string; status: "Simulated" | "Sample" | "Offline preview" }
export const initialHistoryCoverage = Object.fromEntries(tradingAccounts.map((a, i) => [a.id, { last: a.connected ? new Date(base - i * 864e5).toISOString() : null, from: a.connected ? "2026-08-01" : null, to: a.connected ? "2026-11-19" : null }]));

export const mappingSuggestions: { accountId: string; canonical: string; brokerSymbol: string; confidence: number; note: string }[] = [
  { accountId: "acc-exness-raw", canonical: "XAUUSD", brokerSymbol: "XAUUSD", confidence: 0.94, note: "Raw spread profile may use an unsuffixed gold symbol." },
  { accountId: "acc-exness-raw", canonical: "EURUSD", brokerSymbol: "EURUSD", confidence: 0.92, note: "Review unsuffixed FX mapping against this account type." },
  { accountId: "acc-exness-trial", canonical: "NAS100", brokerSymbol: "USTECm", confidence: 0.96, note: "Sample MT5 Nasdaq identifier confirmed in the catalog." },
  { accountId: "acc-deriv-demo", canonical: "EURUSD", brokerSymbol: "frxEURUSD", confidence: 0.96, note: "Sample Deriv forex alias with frx prefix." },
];
