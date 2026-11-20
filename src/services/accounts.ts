import { getTransferHistory, transferRails } from "./transfers";
import { getWithdrawalHistory, withdrawalRails } from "./withdrawals";
import { fundingRails, getDepositHistory } from "./deposits";
import type { AccountFinanceEntry } from "@/data/accounts";
import { hubProviders, initialAccountAudit, initialHistoryCoverage, mappingSuggestions, providerCapabilities, readyMessage, type AccountAudit, type AccountEvent } from "@/data/accounts";
import { marketSymbols } from "@/data/markets";
import { createPaperAccount, getAccounts, getAdapters, getPositions, type BrokerKey, type TradingAccount } from "./dashboard";
import { getTradeRecords } from "./records";
import { latency } from "./_latency";
import { mappedBrokerSymbol, readAccountSymbolOverrides, resetAccountSymbolOverride, saveAccountSymbolOverride, type AccountSymbolOverride } from "./symbolMappings";

export { readyMessage, providerCapabilities };
export type { AccountAudit, AccountEvent, HubProvider, Capability } from "@/data/accounts";
export type { BrokerKey, TradingAccount } from "./dashboard";
export type { AccountSymbolOverride } from "./symbolMappings";
const audit = structuredClone(initialAccountAudit);
const history = structuredClone(initialHistoryCoverage);
export const getBrokerProviders = () => latency(hubProviders);
export const getAccountAudit = () => latency(audit);
const makeId = () => globalThis.crypto.randomUUID();
function recordEvent(event: AccountEvent, broker: BrokerKey, outcome: AccountAudit["outcome"], detail: string, accountId?: string) {
  audit.unshift({ id: makeId(), event, broker, outcome, detail, accountId, at: new Date().toISOString() });
}
export async function auditContextSelection(account: TradingAccount | undefined, mode: "paper" | "live", count: number) {
  recordEvent("Routing changed", account?.broker ?? "paper", "Local", `${mode === "paper" ? "Paper" : "Live preview"} routing · ${count} default ${count === 1 ? "target" : "targets"}.`, account?.id);
  return latency({ saved: true });
}
export async function addPaperWorkspace(input: { label: string; startingBalance: number }) {
  const account = await createPaperAccount(input);
  recordEvent("Paper created", "paper", "Local", "USD simulation workspace created. No funds moved.", account.id);
  return account;
}
export interface BrokerSetup { broker: BrokerKey; label: string; environment: "demo" | "live"; accountId?: string; server?: string; region?: string; endpoint?: string; permissions: string[]; mockTwoFactor?: boolean }
function validateSetup(input: BrokerSetup) {
  const provider = hubProviders.find((p) => p.id === input.broker);
  if (!provider || provider.id === "paper") throw new Error("Choose an external broker.");
  if (input.label.trim().length < 2 || input.label.trim().length > 40) throw new Error("Use a label of 2–40 characters.");
  if (!input.permissions.includes("Read account") || input.permissions.some((permission) => !["Read account", "Place orders", "Read history"].includes(permission))) throw new Error("Read account access is required; only preview scopes are accepted.");
  if (provider.connect === "MT5 login + server" && (!/^\d{5,15}$/.test(input.accountId ?? "") || !/^[A-Za-z0-9._ -]{3,64}$/.test(input.server ?? "") || !["london", "new-york", "singapore"].includes(input.region ?? ""))) throw new Error("A sample numeric MT5 login, exact server name and MetaApi region are required.");
  if (input.broker === "oanda" && !/^\d[\d-]{3,29}$/.test(input.accountId ?? "")) throw new Error("Enter a sample OANDA account ID (numbers and hyphens).");
  if (provider.connect === "OAuth" && !input.accountId) throw new Error("Choose a sample account in the OAuth review.");
}
export async function testBrokerSetup(input: BrokerSetup) {
  validateSetup(input);
  return latency({ checks: ["Configuration shape", "Requested permissions", "Environment selection"], message: "Local validation passed. Authentication, balance proof and broker access were not run.", balance: null });
}
export async function stageBrokerSetup(input: BrokerSetup) {
  validateSetup(input);
  if (input.environment === "live" && !input.mockTwoFactor) throw new Error("Complete the demo 2FA gate before staging a live configuration.");
  recordEvent("Setup preview", input.broker, "Ready", `${input.environment === "live" ? "Live" : "Demo"} configuration reviewed. No credentials stored or broker session created.`);
  return latency({ mode: "ready" as const, message: readyMessage, steps: ["Vault save", "Symbol sync", "Positions sync", "History backfill"] });
}

export async function getHubAdapters() {
  const [adapters, accounts] = await Promise.all([getAdapters(), getAccounts()]);
  return adapters.map((adapter, i) => ({ ...adapter,
    p50: adapter.latencyMs, p95: Math.ceil(adapter.latencyMs * (1.45 + (i % 3) * .25)), reconnects: adapter.broker === "exness" ? 2 : 0,
    ws: adapter.broker === "paper" ? "Local engine" : adapter.status === "standby" ? "Standby" : "Offline · snapshot",
    error: adapter.broker === "exness" ? "Sample incident: MT5 bridge reported a timeout. No reconnect has been attempted in this preview." : "",
    limits: [{ name: "Quotes", pct: adapter.rateHeadroomPct }, { name: "Orders", pct: Math.max(0, adapter.rateHeadroomPct - (adapter.broker === "paper" ? 0 : 9)) }, { name: "History", pct: Math.max(0, adapter.rateHeadroomPct - (adapter.broker === "paper" ? 0 : 16)) }],
    accountIds: accounts.filter((a) => a.broker === adapter.broker).map((a) => a.id),
  }));
}
export type HubAdapter = Awaited<ReturnType<typeof getHubAdapters>>[number];
export type AdapterAction = "Run diagnostics" | "Reconnect" | "Refresh symbols" | "Re-sync history" | "Review permissions" | "Rotate credentials" | "Disconnect";
export async function runAccountAction(input: { broker: BrokerKey; accountId?: string; action: AdapterAction }) {
  const account = input.accountId ? (await getAccounts()).find((a) => a.id === input.accountId) : undefined;
  if (input.accountId && (!account || input.broker !== account.broker)) throw new Error("Account not found for this adapter.");
  const local = input.broker === "paper";
  const own = local && (input.action === "Run diagnostics" || input.action === "Refresh symbols" || input.action === "Re-sync history" || input.action === "Review permissions");
  const event: Record<AdapterAction, AccountEvent> = { "Run diagnostics": "Diagnostics", Reconnect: "Reconnect requested", "Refresh symbols": "Symbol refresh", "Re-sync history": "History sync", "Review permissions": "Permissions reviewed", "Rotate credentials": "Credential rotation", Disconnect: "Disconnect requested" };
  const positions = own && input.action === "Run diagnostics" ? await getPositions({ accountId: input.accountId }) : [];
  const checks = [
    { name: "Authentication", status: local ? "Not required" : "Not run", detail: local ? "No credentials for the local engine" : "Backend vault and broker session required" },
    { name: "Ticks / quote feed", status: local ? "Static" : "Not run", detail: "Ticks are disabled in this workspace" },
    { name: "Positions", status: local ? "Pass" : "Not run", detail: local ? `${positions.filter((p) => p.broker === "paper").length} local open positions readable` : "No broker request was made" },
    { name: "Broker clock skew", status: "Not measured", detail: local ? "Only the browser clock is available" : "Needs an authenticated adapter connection" },
  ];
  let message = readyMessage;
  if (own && input.action === "Run diagnostics") message = "Local engine diagnostics complete. No broker was contacted.";
  if (own && input.action === "Review permissions") message = "This account can read the sample catalog and ledger, place simulated orders, and modify local stops. It cannot move funds or contact a broker.";
  if (own && input.action === "Refresh symbols") message = `Read ${marketSymbols.filter((s) => s.brokerSymbols.paper).length} symbols from the local Paper catalog.`;
  if (own && input.action === "Re-sync history" && account) {
    const days = (await getTradeRecords()).filter((r) => r.accountId === account.id).map((r) => r.closedAt.slice(0, 10)).sort();
    history[account.id] = { last: new Date().toISOString(), from: days[0] ?? null, to: days[days.length - 1] ?? null };
    message = `Reviewed ${days.length} closed trades in the local ledger. No external backfill ran.`;
  }
  recordEvent(event[input.action], input.broker, own ? "Local" : "Ready", message, input.accountId);
  return latency({ mode: own ? "local" as const : "ready" as const, message, checks: input.action === "Run diagnostics" ? checks : [] });
}
export async function getAccountDetail(accountId: string) {
  const [accounts, finance] = await Promise.all([getAccounts(), getAccountFinance()]);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("Account unavailable.");
  return latency({ account, finance: finance.filter((e) => e.accountId === accountId), history: history[account.id] ?? { last: null, from: null, to: null }, capabilities: providerCapabilities(account.broker), audit: audit.filter((a) => a.accountId === accountId) });
}
export async function getAccountFinance(): Promise<AccountFinanceEntry[]> {
  const [depositRows, withdrawalRows, transferRows] = await Promise.all([getDepositHistory(), getWithdrawalHistory(), getTransferHistory()]);
  const deposits = depositRows.map((row): AccountFinanceEntry => ({ id: row.ref, accountId: row.accountId, kind: "Deposit", amount: row.amountNative, currency: row.currencyNative, rail: fundingRails[row.rail].title, at: row.initiatedAt, status: row.origin === "Simulated" ? "Simulated" : row.origin === "Preview" ? "Offline preview" : "Sample" }));
  const withdrawals = withdrawalRows.map((row): AccountFinanceEntry => ({ id: row.ref, accountId: row.accountId, kind: "Withdrawal", amount: row.amountNative, currency: row.currencyNative, rail: withdrawalRails[row.rail].name, at: row.initiatedAt, status: row.origin === "Simulated" ? "Simulated" : row.origin === "Preview" ? "Offline preview" : "Sample" }));
  const transfers = transferRows.flatMap((row): AccountFinanceEntry[] => {
    const base = { kind: "Transfer" as const, at: row.initiatedAt, status: row.origin === "Simulated" ? "Simulated" as const : row.origin === "Preview" ? "Offline preview" as const : "Sample" as const };
    const out = { ...base, id: row.ref, accountId: row.accountId, amount: row.amountNative, currency: row.currencyNative, rail: `${transferRails[row.rail].title} · ${row.accountId === row.toAccountId ? "wallet movement" : "out"}` };
    return row.accountId === row.toAccountId ? [out] : [out,{ ...base, id: `${row.ref}-IN`, accountId: row.toAccountId, amount: row.creditNative, currency: row.toCurrency, rail: `${transferRails[row.rail].title} · in` }];
  });
  return [...deposits, ...withdrawals, ...transfers].sort((a,b) => b.at.localeCompare(a.at));
}
export async function getAccountMappings(accountId: string) {
  const account = (await getAccounts()).find((a) => a.id === accountId);
  if (!account) throw new Error("Select an account to view symbol mappings.");
  const overrides = readAccountSymbolOverrides();
  return latency(marketSymbols.map((s) => {
    const override = overrides.find((m) => m.accountId === account.id && m.canonical === s.canonical);
    const suggestion = mappingSuggestions.find((m) => m.accountId === account.id && m.canonical === s.canonical);
    return { canonical: s.canonical, name: s.name, broker: account.broker, brokerSymbol: mappedBrokerSymbol(s, account, overrides), defaultSymbol: s.brokerSymbols[account.broker], pip: s.pip, step: s.volumeStep, min: s.minVolume, max: s.maxVolume, unit: s.volumeUnit, sessions: s.sessions.map((session) => session.label).join(" · "), source: override?.source ?? "Catalog", suffix: override?.suffix, suggestion };
  }));
}
export type HubMapping = Awaited<ReturnType<typeof getAccountMappings>>[number];
export async function updateHubMapping(input: AccountSymbolOverride & { reset?: boolean }) {
  const account = (await getAccounts()).find((a) => a.id === input.accountId);
  if (!account) throw new Error("Account not found.");
  const { reset, ...mapping } = input;
  if (reset) await resetAccountSymbolOverride(input.accountId, input.canonical);
  else await saveAccountSymbolOverride(mapping);
  recordEvent("Mapping updated", account.broker, "Local", reset ? `${input.canonical} restored to catalog mapping.` : `${input.canonical} → ${input.brokerSymbol} (${input.source}). Only local routing is affected.`, account.id);
  return { updated: true };
}
export async function exportAccountAudit(ids: string[]) {
  const list = ids.flatMap((id) => audit.find((a) => a.id === id) ?? []);
  if (!list.length) throw new Error("No audit events match the current filters.");
  const rows = [["Time (UTC)","Broker","Account ID","Event","Outcome","Details"], ...list.map((a) => [a.at, a.broker, a.accountId ?? "", a.event, a.outcome, a.detail])];
  return latency({ filename: "ostrade-account-audit.csv", text: rows.map((r) => r.map((v) => `"${(/^[=+@\-\t\r\n]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`).join(",")).join("\r\n") });
}
