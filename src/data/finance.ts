// The shared finance transaction shape for funding previews and the simulated ledger (§8).
import { tradingAccounts, type BrokerKey } from "./dashboard";

export type FundingCurrency = "USD" | "KES" | "USDT";
export type DepositStatus = "INITIATED" | "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
export type DepositRailId = "paper" | "mpesa-agent" | "cashier" | "crypto" | "manual" | "ach" | "wire" | "internal";
export type FailureReason = "Timeout" | "Underpaid" | "Wrong network" | "Agent unreachable" | "Broker rejection";
export type CryptoNetwork = "TRC20" | "ERC20" | "BEP20";
export type Rail = { id: DepositRailId; title: string; category: string; currency: FundingCurrency; min: number; max: number; fee: number; eta: string; note: string; mode: "Simulated" | "Agent" | "Hosted" | "API preview" | "Proof required"; };
export const fundingRails: Record<DepositRailId, Rail> = {
  paper: { id: "paper", title: "Paper top-up", category: "Simulation", currency: "USD", min: 10, max: 100000, fee: 0, eta: "Instant", note: "Credit the local simulator. No real funds or payment details.", mode: "Simulated" },
  "mpesa-agent": { id: "mpesa-agent", title: "M-Pesa payment agent", category: "Kenya · Mobile money", currency: "KES", min: 500, max: 100000, fee: 25, eta: "5–15 min", note: "Preview the Kenya agent flow with a sample phone number.", mode: "Agent" },
  cashier: { id: "cashier", title: "Broker cashier", category: "Deriv · Hosted page", currency: "USD", min: 10, max: 10000, fee: 0, eta: "5–30 min", note: "Review the hosted handoff and its transaction matching rules.", mode: "Hosted" },
  crypto: { id: "crypto", title: "Crypto deposit", category: "USDT · On-chain", currency: "USDT", min: 10, max: 20000, fee: 0, eta: "10–60 min", note: "Inspect network instructions with a non-payable demo QR.", mode: "API preview" },
  manual: { id: "manual", title: "Manual funding proof", category: "Broker portal · Proof upload", currency: "USD", min: 10, max: 50000, fee: 0, eta: "1 business day", note: "Attach sample proof and review how a broker credit is reconciled.", mode: "Proof required" },
  ach: { id: "ach", title: "ACH bank transfer", category: "Alpaca · US banks", currency: "USD", min: 25, max: 25000, fee: 0, eta: "1–3 business days", note: "Preview a verified US bank funding relationship.", mode: "API preview" },
  wire: { id: "wire", title: "Manual wire proof", category: "Alpaca · Bank wire", currency: "USD", min: 100, max: 50000, fee: 15, eta: "1–3 business days", note: "Draft wire proof without revealing bank or routing numbers.", mode: "Proof required" },
  internal: { id: "internal", title: "Internal funding", category: "Binance · Funding wallet", currency: "USDT", min: 10, max: 20000, fee: 0, eta: "Usually instant", note: "Preview a funding wallet transfer. No balance is changed.", mode: "API preview" },
};
export const brokerRails: Record<BrokerKey, DepositRailId[]> = {
  paper: ["paper"], deriv: ["mpesa-agent", "cashier", "crypto"], exness: ["manual"], alpaca: ["ach", "wire"], binance: ["crypto", "internal"], oanda: ["manual"], ctrader: ["manual"], icmarkets: ["manual"], pepperstone: ["manual"], xm: ["manual"],
};
export interface DepositAgent { id: string; name: string; city: string; country: "KE"; currency: "KES"; min: number; max: number; fee: number; available: boolean; }
const locations = ["Nairobi CBD", "Juja", "Thika", "Westlands", "Ruiru", "Nakuru", "Mombasa", "Kiambu", "Kisumu", "Eldoret"];
export const depositAgents: DepositAgent[] = locations.map((city, i) => ({ id: `KE-SAMPLE-${i + 1}`, name: `${city} · Sample agent ${String(i + 1).padStart(2,"0")}`, city, country: "KE", currency: "KES", min: i % 3 ? 500 : 1000, max: 25000 + (i % 5) * 15000, fee: 25 + (i % 3) * 5, available: i !== 4 && i !== 8 }));
export const networkProfiles = [
  { id: "TRC20", name: "Tron", required: 19, feeNote: "Typically lower network fee", ttl: "30 min" },
  { id: "ERC20", name: "Ethereum", required: 12, feeNote: "Variable Ethereum network fee", ttl: "30 min" },
  { id: "BEP20", name: "BNB Smart Chain", required: 15, feeNote: "Variable BNB network fee", ttl: "30 min" },
] as const;
export const sampleUsdKes = 129.5;
export const convertToUSD = (n: number, c: string) => +(c === "KES" ? n / sampleUsdKes : n).toFixed(2);
export type DepositDetails =
  | { rail: "mpesa-agent"; agentLabel: string; maskedPhone: string }
  | { rail: "cashier"; matchingWindowMinutes: number }
  | { rail: "manual" | "wire"; method: string; expectedCredit: number }
  | { rail: "ach"; bankLabel: string }
  | { rail: "internal"; wallet: string };
export const manualMethods = ["Bank transfer", "M-Pesa processor", "Crypto via broker portal"] as const;
export const sampleBanks = { "demo-checking": "Demo checking •••• 1024", "demo-savings": "Demo savings •••• 2068" } as const;
export type FinanceProof = { id: string; label: string };
export interface FinanceTransactionBase {
  id: string; ref: string; accountId: string; accountLabel: string; broker: BrokerKey; amountNative: number; currencyNative: FundingCurrency; amountUSD: number; fee: number;
  origin: "Snapshot" | "Simulated" | "Preview"; brokerRef?: string; proof?: FinanceProof; network?: CryptoNetwork;
  idempotencyKey: string; initiatedAt: string; settledAt?: string; ledgerRef?: string;
}
export interface DepositRecord extends FinanceTransactionBase {
  type: "DEPOSIT"; rail: DepositRailId;
  status: DepositStatus; details?: DepositDetails; confirmations?: number; failure?: FailureReason; parentRef?: string;
}
export type FinanceEntryType = "DEPOSIT" | "WITHDRAW" | "TRANSFER_IN" | "TRANSFER_OUT" | "TRADE_PNL" | "COMMISSION" | "SWAP" | "ADJUSTMENT" | "FX_GAIN" | "FX_LOSS";
export interface FinanceLedgerEntry { id: string; txType: FinanceEntryType; currencyNative?: FundingCurrency; debitAccountId: string; creditAccountId: string; amountNative: number; amountUSD: number; sourceRef: string; accountLabel: string; postedAt: string; memo: string; balanceAfterCredit?: number; balanceAfterDebit?: number; origin: "Snapshot" | "Simulated"; }
export type RecoveryEvent = { id: string; at: string; depositRef: string; action: "Retry reviewed" | "Agent contact preview" | "Manual match staged" | "Support opened"; detail: string };
export const recoveryReasons: Record<FailureReason, { title: string; guidance: string }> = {
  Timeout: { title: "Review retry", guidance: "Check the broker’s original payment status before starting a second request." },
  Underpaid: { title: "Review TX hash", guidance: "Review the transaction hash for a manual match. Do not send an extra payment from this preview." },
  "Wrong network": { title: "Review TX hash", guidance: "Wrong-network transfers may be irreversible. Record a sample hash for a manual review." },
  "Agent unreachable": { title: "Review agent contact", guidance: "Review the agent handoff. No phone call, message, or transfer is initiated here." },
  "Broker rejection": { title: "Review support", guidance: "Use the broker reference when contacting official support. Never include credentials." },
};
const byId = (id: string) => tradingAccounts.find((a) => a.id === id)!;
const sampleRows: [string, DepositRailId, number, DepositStatus, number, FailureReason?][] = [
  ["acc-deriv-demo","mpesa-agent",19250,"PENDING",.055], ["acc-paper-main","paper",500,"CONFIRMED",.1], ["acc-exness-trial","manual",725,"CONFIRMED",.125],
  ["acc-binance-testnet","crypto",1180,"PENDING",.24], ["acc-deriv-demo","cashier",250,"CONFIRMED",.8], ["acc-alpaca-paper","ach",1000,"CONFIRMED",1.3],
  ["acc-deriv-demo","cashier",480,"FAILED",1.8,"Timeout"], ["acc-binance-testnet","crypto",492,"FAILED",2.5,"Underpaid"], ["acc-exness-trial","manual",150,"PENDING",2.7],
  ["acc-deriv-demo","mpesa-agent",37500,"FAILED",3.2,"Agent unreachable"], ["acc-binance-testnet","crypto",740,"FAILED",4.1,"Wrong network"], ["acc-oanda-practice","manual",550,"FAILED",4.7,"Broker rejection"],
  ["acc-binance-testnet","internal",900,"CONFIRMED",5.4], ["acc-deriv-demo","crypto",380,"EXPIRED",6.3,"Timeout"], ["acc-paper-main","paper",1000,"CONFIRMED",7],
  ["acc-deriv-demo","mpesa-agent",48000,"CONFIRMED",9], ["acc-exness-raw","manual",675,"CONFIRMED",11], ["acc-binance-testnet","crypto",2400,"CONFIRMED",14],
  ["acc-alpaca-paper","wire",3600,"CONFIRMED",19], ["acc-oanda-practice","manual",950,"CONFIRMED",25], ["acc-paper-main","paper",2000,"CONFIRMED",48],
];
const anchor = Date.now();
const confirmMinutes: Partial<Record<DepositRailId,number>> = { paper: 0, "mpesa-agent": 9, cashier: 19, crypto: 43, internal: 2, manual: 155, ach: 1560, wire: 2400 };
export const initialDeposits: DepositRecord[] = sampleRows.map(([id, rail, amount, status, days, failure], i) => {
  const account = byId(id), method = fundingRails[rail], seq = String(4102 - i).padStart(6,"0");
  const started = anchor - days * 864e5;
  const settled = status === "CONFIRMED" ? new Date(started + (confirmMinutes[rail] ?? 10) * 60000).toISOString() : undefined;
  return { id: `deposit-snapshot-${seq}`, ref: `OS-FIN-${seq}`, accountId: id, accountLabel: account.label, broker: account.broker, type: "DEPOSIT", rail, amountNative: amount, currencyNative: method.currency, amountUSD: convertToUSD(amount, method.currency), fee: method.fee, status, origin: "Snapshot", brokerRef: rail === "paper" ? undefined : rail === "crypto" ? `DEMO-HASH-${seq}-NO-VALUE` : `SAMPLE-${account.broker.toUpperCase()}-${seq}`, proof: ["wire","manual"].includes(rail) && status !== "FAILED" ? { id: `sample-proof-${seq}`, label: "Sample proof" } : undefined, network: rail === "crypto" ? i % 2 ? "TRC20" : "ERC20" : undefined, confirmations: rail === "crypto" ? status === "CONFIRMED" ? i % 2 ? 19 : 12 : status === "PENDING" ? 8 : 0 : undefined, idempotencyKey: `sample-${seq}`, initiatedAt: new Date(started).toISOString(), settledAt: settled, ledgerRef: settled ? `OS-LED-${seq}` : undefined, failure };
});
export const initialDepositLedger: FinanceLedgerEntry[] = initialDeposits.flatMap((r) => r.settledAt && r.ledgerRef ? [{ id: r.ledgerRef, txType: "DEPOSIT", currencyNative: r.currencyNative, sourceRef: r.ref, debitAccountId: "sample-funding-clearing", creditAccountId: r.accountId, accountLabel: r.accountLabel, amountNative: r.amountNative, amountUSD: r.amountUSD, postedAt: r.settledAt, memo: "Historical fixture · no balance change applied", origin: "Snapshot" }] : []);
export const supportUrls: Partial<Record<BrokerKey,string>> = { deriv: "https://deriv.com/help-centre/", exness: "https://get.exness.help/hc/en-us", binance: "https://www.binance.com/en/support", alpaca: "https://alpaca.markets/support", oanda: "https://help.oanda.com/" };
