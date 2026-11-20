import { tradingAccounts, type BrokerKey } from "./dashboard";
import { convertToUSD, networkProfiles, sampleUsdKes, type CryptoNetwork, type FinanceLedgerEntry, type FinanceTransactionBase, type FundingCurrency } from "./finance";

export type WithdrawalRailId = "paper" | "deriv-api" | "mpesa" | "cashier" | "crypto" | "ach" | "manual";
export type WithdrawalStatus = "REQUESTED" | "OTP_VERIFIED" | "SUBMITTED" | "PROCESSING" | "SETTLED" | "REJECTED" | "REVERSED" | "COOLING" | "READY";
export type DestinationKind = "crypto" | "bank" | "phone" | "portal" | "simulation";
export interface WithdrawalRail { id: WithdrawalRailId; name: string; note: string; eta: string; fee: number; currency: FundingCurrency; min: number; max: number; mode: "Simulated" | "Adapter preview" | "Conditional" | "Hosted" | "Manual proof"; }
export const withdrawalRails: Record<WithdrawalRailId, WithdrawalRail> = {
  paper: { id: "paper", name: "Paper withdrawal", note: "Debit simulated buying power and post to the local ledger.", eta: "Instant if cleared", fee: 0, currency: "USD", min: 10, max: 10000, mode: "Simulated" },
  "deriv-api": { id: "deriv-api", name: "Deriv withdrawal API", note: "Preview identity, turnover and original funding method requirements.", eta: "1–2 business days", fee: 0, currency: "USD", min: 10, max: 10000, mode: "Conditional" },
  mpesa: { id: "mpesa", name: "M-Pesa payment agent", note: "Kenya agent route to a registered sample mobile number.", eta: "5–30 min", fee: 0, currency: "KES", min: 500, max: 100000, mode: "Conditional" },
  cashier: { id: "cashier", name: "Deriv hosted cashier", note: "Preview the handoff; hosted URL requires the backend.", eta: "1–2 business days", fee: 0, currency: "USD", min: 10, max: 10000, mode: "Hosted" },
  crypto: { id: "crypto", name: "Crypto withdrawal", note: "Select a network and approved demo address; fees vary by network.", eta: "10–60 min", fee: 0, currency: "USDT", min: 10, max: 20000, mode: "Adapter preview" },
  ach: { id: "ach", name: "ACH bank withdrawal", note: "Use a masked, pre-approved sample US bank account.", eta: "1–3 business days", fee: 0, currency: "USD", min: 25, max: 25000, mode: "Adapter preview" },
  manual: { id: "manual", name: "Manual withdrawal proof", note: "Stage a portal checklist or attach sample proof and a broker reference.", eta: "1–3 business days", fee: 0, currency: "USD", min: 10, max: 50000, mode: "Manual proof" },
};
export const brokerWithdrawalRails: Record<BrokerKey, WithdrawalRailId[]> = {
  paper: ["paper"], deriv: ["deriv-api", "mpesa", "cashier", "manual"], binance: ["crypto", "manual"], alpaca: ["ach", "manual"], exness: ["manual"], oanda: ["manual"], ctrader: ["manual"], icmarkets: ["manual"], pepperstone: ["manual"], xm: ["manual"],
};
export const cryptoWithdrawalNetworks = networkProfiles.map((n, i) => ({ ...n, fee: [1, 6.5, .45][i], eta: ["5–15 min", "15–60 min", "5–20 min"][i] }));
export const defaultWithdrawalPolicy = { dailyCap: 5000, txCap: 2500, coolingHours: 24, coolingThreshold: 500, enforcement: "strict" as "strict" | "warn", pauseWhenHalted: true };
export type WithdrawalPolicy = typeof defaultWithdrawalPolicy;
export interface WithdrawalDestination { id: string; label: string; masked: string; kind: DestinationKind; network?: CryptoNetwork; state: "Approved sample" | "Cooling"; availableAt?: string; origin: "Snapshot" | "Preview"; }
const maskedCrypto = (network: CryptoNetwork, tag: string) => `DEMO ${network} •••• ${tag}`;
export const initialWithdrawalDestinations: WithdrawalDestination[] = [
  ...([ ["TRC20", "Treasury · Tron", "018A"], ["ERC20", "Treasury · Ethereum", "042E"], ["BEP20", "Reserve · BNB", "907B"], ["TRC20", "Rebalance · Tron", "638T"], ["ERC20", "Vault · Ethereum", "991E"], ["BEP20", "Test vault · BNB", "376B"] ] as const).map(([network,label,tag], i): WithdrawalDestination => ({ id: `wallet-${i + 1}`, label, masked: maskedCrypto(network, tag), kind: "crypto", network, state: "Approved sample", origin: "Snapshot" })),
  { id: "bank-1", label: "Demo checking", masked: "US bank •••• 1024", kind: "bank", state: "Approved sample", origin: "Snapshot" },
  { id: "bank-2", label: "Demo savings", masked: "US bank •••• 2068", kind: "bank", state: "Approved sample", origin: "Snapshot" },
  { id: "phone-1", label: "Registered sample mobile", masked: "+254 7•• ••• 024", kind: "phone", state: "Approved sample", origin: "Snapshot" },
  { id: "portal", label: "Original funding method", masked: "Broker portal ••••", kind: "portal", state: "Approved sample", origin: "Snapshot" },
  { id: "paper-sink", label: "Simulation clearing", masked: "Local simulator only", kind: "simulation", state: "Approved sample", origin: "Snapshot" },
];
export interface WithdrawalEvent { status: WithdrawalStatus; at: string; note: string; }
export interface WithdrawalRecord extends FinanceTransactionBase {
  type: "WITHDRAW"; rail: WithdrawalRailId; status: WithdrawalStatus; receiveNative: number; destinationMasked: string;
  timeline: WithdrawalEvent[]; settlementRef?: string; coolingUntil?: string; method?: string; message: string;
}
export interface WithdrawalAudit { id: string; at: string; action: "Request staged" | "Paper debit posted" | "Safety policy updated" | "Destination staged" | "Deriv preflight" | "Deriv status preview" | "Cashier handoff preview"; outcome: "Offline" | "Simulated" | "Held"; request: string; result: string; ref?: string; }
export const statusLabels: Record<WithdrawalStatus, string> = { REQUESTED: "Requested", OTP_VERIFIED: "OTP checked", SUBMITTED: "Submitted", PROCESSING: "Processing", SETTLED: "Settled", REJECTED: "Rejected", REVERSED: "Reversed", COOLING: "Cooling hold", READY: "Ready · offline" };
const rows: [string, WithdrawalRailId, number, WithdrawalStatus, number][] = [
  ["acc-deriv-demo", "deriv-api", 150, "PROCESSING", .04], ["acc-binance-testnet", "crypto", 585, "OTP_VERIFIED", .08],
  ["acc-paper-main", "paper", 300, "SETTLED", .12], ["acc-exness-trial", "manual", 245, "REQUESTED", .15],
  ["acc-deriv-demo", "mpesa", 18250, "SETTLED", .25], ["acc-binance-testnet", "crypto", 490, "REJECTED", 1],
  ["acc-alpaca-paper", "ach", 600, "PROCESSING", 1.4], ["acc-deriv-live", "cashier", 625, "SUBMITTED", 1.8],
  ["acc-exness-raw", "manual", 155, "SETTLED", 2.1], ["acc-oanda-practice", "manual", 780, "REVERSED", 2.6],
  ["acc-ctrader-demo", "manual", 195, "REJECTED", 3.3], ["acc-deriv-live", "deriv-api", 250, "SETTLED", 4],
  ["acc-binance-testnet", "crypto", 870, "SETTLED", 5.2], ["acc-alpaca-paper", "ach", 300, "SETTLED", 6],
  ["acc-icm-demo", "manual", 650, "SETTLED", 9], ["acc-oanda-practice", "manual", 995, "SETTLED", 12],
  ["acc-paper-main", "paper", 500, "SETTLED", 16], ["acc-deriv-demo", "cashier", 225, "SETTLED", 24],
];
const anchor = Date.now();
const steps: WithdrawalStatus[] = ["REQUESTED", "OTP_VERIFIED", "SUBMITTED", "PROCESSING", "SETTLED"];
export const initialWithdrawals: WithdrawalRecord[] = rows.map(([accountId, rail, amountNative, status, days], i) => {
  const account = tradingAccounts.find(a => a.id === accountId)!;
  const currencyNative = withdrawalRails[rail].currency;
  const amountUSD = convertToUSD(amountNative,currencyNative);
  const seq = String(7200 - i).padStart(6,"0"), ref = `OS-FIN-${seq}`, started = anchor - days * 864e5;
  const fee = rail === "crypto" ? 1 : rail === "mpesa" ? 35 : 0;
  const states = steps.includes(status) ? steps.slice(0, steps.indexOf(status)+1) : [...steps.slice(0, status === "REVERSED" ? 5 : 4), status];
  const timeline = states.map((stage,j): WithdrawalEvent => ({ status: stage, at: new Date(started + j * 300_000).toISOString(), note: stage === "REJECTED" ? "Sample broker response: destination or profile not eligible." : stage === "REVERSED" ? "Sample reversal; no funds moved in this workspace." : `${statusLabels[stage]} · historical example` }));
  return { id: `withdrawal-sample-${seq}`, ref, type: "WITHDRAW", accountId, accountLabel: account.label, broker: account.broker, rail, amountNative, currencyNative, amountUSD, fee, receiveNative: +(amountNative - fee).toFixed(2), status, origin: "Snapshot", network: rail === "crypto" ? "TRC20" : undefined, destinationMasked: rail === "crypto" ? maskedCrypto("TRC20", "018A") : rail === "ach" ? "US bank •••• 1024" : rail === "mpesa" ? "+254 7•• ••• 024" : rail === "paper" ? "Local simulator only" : "Broker portal ••••", initiatedAt: timeline[0].at, idempotencyKey: `sample-withdrawal-${seq}`, settledAt: status === "SETTLED" ? timeline[timeline.length - 1].at : undefined, settlementRef: status === "SETTLED" ? `OS-SET-${seq}` : undefined, ledgerRef: status === "SETTLED" ? `OS-LED-${seq}` : undefined, brokerRef: rail !== "paper" && states.includes("SUBMITTED") ? `DEMO-${account.broker.toUpperCase()}-${seq}` : undefined, timeline, message: timeline[timeline.length - 1].note };
});
export const initialWithdrawalLedger: FinanceLedgerEntry[] = initialWithdrawals.flatMap(row => row.ledgerRef && row.settledAt ? [{ id: row.ledgerRef, txType: "WITHDRAW", currencyNative: row.currencyNative, debitAccountId: row.accountId, creditAccountId: "sample-withdrawal-clearing", amountNative: row.amountNative, amountUSD: row.amountUSD, sourceRef: row.ref, accountLabel: row.accountLabel, postedAt: row.settledAt, memo: "Historical example · no balance change applied", origin: "Snapshot" }] : []);
export const initialWithdrawalAudit: WithdrawalAudit[] = initialWithdrawals.slice(0, 12).map(row => ({ id: `audit-${row.id}`, at: row.initiatedAt, action: "Request staged", outcome: "Offline", request: `Historical example · ${withdrawalRails[row.rail].name} · ${row.destinationMasked}`, result: row.message, ref: row.ref }));
export const nativeAmount = (usd: number, currency: FundingCurrency) => +(currency === "KES" ? usd * sampleUsdKes : usd).toFixed(2);
