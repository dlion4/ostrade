import { initialDepositLedger, type FinanceLedgerEntry } from "@/data/finance";
import { initialWithdrawalLedger } from "@/data/withdrawals";
import { accountingSamples, ledgerAnchor, transferSeedLedger } from "@/data/transfers";
import { initialTradeRecords, type TradeRecord } from "@/data/records";
import { latency } from "./_latency";

export function tradeLedgerEntries(r: TradeRecord, origin: FinanceLedgerEntry["origin"]): FinanceLedgerEntry[] {
  return ([ ["TRADE_PNL",r.gross], ["COMMISSION",r.commission], ["SWAP",r.swap] ] as const).flatMap(([txType,net]) => {
    const amount = Math.round(Math.abs(net)*100)/100;
    if (!amount) return [];
    const clearing = `${origin.toLowerCase()}-${txType.toLowerCase()}-clearing`;
    return [{ id:`LED-${r.id}-${txType}`, txType, debitAccountId:net<0?r.accountId:clearing, creditAccountId:net<0?clearing:r.accountId, currencyNative:"USD", amountNative:amount, amountUSD:amount, sourceRef:r.ref, accountLabel:r.accountLabel, postedAt:origin==="Snapshot"&&Date.parse(r.closedAt)>ledgerAnchor ? new Date(ledgerAnchor-3_600_000).toISOString() : r.closedAt, memo:`${r.symbol} · ${origin === "Simulated" ? "local close" : "historical fixture"}`, origin }];
  });
}
const entries = structuredClone([...initialDepositLedger, ...initialWithdrawalLedger, ...transferSeedLedger, ...accountingSamples, ...initialTradeRecords.flatMap(r => tradeLedgerEntries(r,"Snapshot"))]);
export const readFinanceLedger = (type?: FinanceLedgerEntry["txType"]) => structuredClone(entries.filter(e => !type || e.txType === type).sort((a,b) => b.postedAt.localeCompare(a.postedAt) || b.id.localeCompare(a.id)));
export const getFinanceLedger = (type?: FinanceLedgerEntry["txType"]) => latency(readFinanceLedger(type));
export function postFinanceLedger(entry: FinanceLedgerEntry) {
  if (!entry.id || !entry.sourceRef || !entry.debitAccountId || !entry.creditAccountId || entry.debitAccountId === entry.creditAccountId || !Number.isFinite(entry.amountNative) || entry.amountNative <= 0 || !Number.isFinite(entry.amountUSD) || entry.amountUSD <= 0 || entries.some(e => e.id === entry.id)) throw new Error("Invalid or duplicate ledger posting.");
  entries.unshift(structuredClone(entry));
}
