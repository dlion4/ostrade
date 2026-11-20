import { tradingAccounts, type BrokerKey } from "./dashboard";
import { depositAgents, networkProfiles, type FinanceEntryType, type FinanceLedgerEntry, type FinanceTransactionBase, type FundingCurrency } from "./finance";

export type TransferRail = "paper" | "deriv" | "binance" | "mt5" | "manual";
export const transferRails = {
  paper: { title: "Paper internal", detail: "Move simulated cash between Paper accounts." },
  deriv: { title: "Deriv account transfer", detail: "Preview transfer_between_accounts and its sample rate." },
  binance: { title: "Binance universal transfer", detail: "Preview moves between Spot, Funding and Futures wallets." },
  mt5: { title: "MT5 manual pair", detail: "Preview the source withdrawal and the destination deposit separately." },
  manual: { title: "Cross-account manual", detail: "Review withdrawal and deposit as two ordered legs." },
} satisfies Record<TransferRail,{title:string;detail:string}>;
export const walletOptions = ["Spot", "Funding", "Futures"] as const;
export type Wallet = typeof walletOptions[number];
export const ledgerTypes: Record<FinanceEntryType,string> = { DEPOSIT:"Deposit", WITHDRAW:"Withdrawal", TRANSFER_IN:"Transfer in", TRANSFER_OUT:"Transfer out", TRADE_PNL:"Trade P&L", COMMISSION:"Commission", SWAP:"Swap", ADJUSTMENT:"Adjustment", FX_GAIN:"FX gain", FX_LOSS:"FX loss" };
export type TransferLeg = { title: string; accountLabel: string; gross: number; currency: FundingCurrency; fee: number; eta: string; status: "Planned" | "Waiting for leg 1" | "Posted" | "Reviewed externally (sample)"; ref?: string };
export interface TransferRecord extends FinanceTransactionBase { type: "TRANSFER"; rail: TransferRail; toAccountId: string; toAccountLabel: string; toCurrency: FundingCurrency; creditNative: number; fxRate: number; status: "Posted" | "Offline preview" | "Awaiting proof"; legs: TransferLeg[]; ledgerRefs: string[]; note: string; fromWallet?: Wallet; toWallet?: Wallet; }
const src = (id:string) => tradingAccounts.find(a => a.id === `acc-${id}`)!;
const pairs: [string,string,TransferRail,number,number,boolean,string?][] = [
  ["paper-main","paper-reserve","paper",175,.12,true], ["deriv-demo","deriv-live","deriv",380,.2,true], ["binance-testnet","binance-testnet","binance",425,.45,true], ["exness-trial","exness-raw","mt5",220,.72,false],
  ["deriv-live","exness-raw","manual",340,1,true], ["oanda-practice","alpaca-paper","manual",650,2.5,true], ["paper-reserve","paper-main","paper",75,3.5,true], ["binance-testnet","oanda-practice","manual",420,4,true],
  ["exness-raw","exness-trial","mt5",300,5,true], ["alpaca-paper","deriv-demo","manual",550,11,false], ["deriv-live","deriv-demo","deriv",150,20,true], ["paper-main","paper-reserve","paper",425,40,true],
];
const amountRound = (n:number) => Math.round(n*100)/100;
export const ledgerAnchor = Date.now();
export const initialTransfers: TransferRecord[] = pairs.map(([fromId,toId,rail,amount,days,posted],i) => {
  const from=src(fromId), to=src(toId), ref=`OS-FIN-${String(8400-i).padStart(6,"0")}`, fee=rail === "manual" || rail === "mt5" ? 4 : 0;
  const currencyNative = from.currency as FundingCurrency, toCurrency = to.currency as FundingCurrency;
  const initiatedAt = new Date(ledgerAnchor-days*864e5).toISOString(), settledAt=posted ? new Date(Date.parse(initiatedAt)+12*60000).toISOString():undefined;
  const bridge = rail === "manual" || rail === "mt5";
  const ledgerRefs = settledAt ? bridge ? [`OS-LED-${8400-i}-A`,`OS-LED-${8400-i}-B`] : [`OS-LED-${8400-i}`] : [];
  return { id:`transfer-sample-${i}`, ref, type:"TRANSFER", accountId:from.id, accountLabel:from.label, broker:from.broker, toAccountId:to.id, toAccountLabel:to.label, rail, amountNative:amount, amountUSD:amount, currencyNative, toCurrency, fxRate:1, fee, creditNative:amountRound(amount-fee), status:posted ? "Posted" : "Awaiting proof", origin:"Snapshot", initiatedAt, settledAt, idempotencyKey:`sample-transfer-${i}`, ledgerRefs, note:"Historical example only; no balance was changed by this fixture.", fromWallet:rail==="binance"?"Spot":undefined,toWallet:rail==="binance"?"Funding":undefined,
    legs:bridge ? [{title:"Source withdrawal",accountLabel:from.label,gross:amount,currency:currencyNative,fee:2,eta:"1–2 days",status:posted?"Reviewed externally (sample)":"Planned",ref:posted?`${ref}-W`:undefined},{title:"Destination deposit",accountLabel:to.label,gross:amount-2,currency:toCurrency,fee:2,eta:"1–3 days",status:posted?"Reviewed externally (sample)":"Waiting for leg 1",ref:posted?`${ref}-D`:undefined}] : [{title:transferRails[rail].title,accountLabel:`${from.label} → ${to.label}`,gross:amount,currency:currencyNative,fee,eta:"Instant",status:posted?"Posted":"Planned",ref:posted?ref:undefined}] };
});
export const transferSeedLedger: FinanceLedgerEntry[] = initialTransfers.flatMap(r => {
  const at = r.settledAt, [id,second] = r.ledgerRefs;
  if (!id || !at) return [];
  if(r.rail==="binance"&&r.fromWallet&&r.toWallet) return [{id,txType:"TRANSFER_OUT",debitAccountId:`${r.accountId}:${r.fromWallet}`,creditAccountId:`${r.toAccountId}:${r.toWallet}`,amountNative:r.amountNative,amountUSD:r.amountUSD,currencyNative:r.currencyNative,sourceRef:r.ref,accountLabel:r.accountLabel,postedAt:at,memo:"Historical wallet-to-wallet posting; parent account total unchanged",origin:"Snapshot"}];
  const clearing = `sample-transfer-clearing-${r.ref}`;
  return [{ id, txType:"TRANSFER_OUT" as const, debitAccountId:r.accountId, creditAccountId:second ? clearing : r.toAccountId, amountNative:r.amountNative, amountUSD:r.amountUSD, currencyNative:r.currencyNative, sourceRef:r.ref, accountLabel:r.accountLabel, postedAt:at, memo:second ? "Sample source withdrawal into clearing" : "Sample paired debit and credit", origin:"Snapshot" as const }, ...(!second ? [] : [{ id:second, txType:"TRANSFER_IN" as const, debitAccountId:clearing, creditAccountId:r.toAccountId, amountNative:r.creditNative, amountUSD:r.creditNative, currencyNative:r.toCurrency, sourceRef:r.ref, accountLabel:r.toAccountLabel, postedAt:at, memo:"Sample destination credit after fees", origin:"Snapshot" as const }, {id:`${second}-F`,txType:"COMMISSION" as const,debitAccountId:clearing,creditAccountId:"sample-transfer-fees",amountNative:r.fee,amountUSD:r.fee,currencyNative:r.currencyNative,sourceRef:r.ref,accountLabel:"Sample transfer clearing",postedAt:at,memo:"Sample bridge fees close the clearing leg",origin:"Snapshot" as const }])];
});
export const accountingSamples: FinanceLedgerEntry[] = ([ ["deriv-live","FX_GAIN",6.25], ["binance-testnet","FX_LOSS",2.10], ["oanda-practice","ADJUSTMENT",14.70] ] as const).map(([accountId,txType,amount],i)=>{
  const a=src(accountId), ref=`OS-ADJ-SAMPLE-${i+1}`, clearing="sample-valuation-clearing";
  return {id:ref,txType,debitAccountId:txType==="FX_LOSS"?a.id:clearing,creditAccountId:txType==="FX_LOSS"?clearing:a.id,amountNative:amount,amountUSD:amount,currencyNative:"USD",sourceRef:ref,accountLabel:a.label,postedAt:new Date(ledgerAnchor-(i+1)*7*864e5).toISOString(),memo:"Historical statement sample · no live rate or broker adjustment",origin:"Snapshot"};
});
export const balanceSnapshots = Object.fromEntries(tradingAccounts.map((a,i) => [a.id, { balance:a.balance + (i===1 ? 37.5 : i===2 ? -82.35 : i===7 ? 19.25 : i===8 ? -26.4 : 0), capturedAt:new Date(ledgerAnchor-(i===3||i===6||i===9 ? 5*864e5 : (i+2)*3600000)).toISOString(), cause:i===1 ? "Pending withdrawal or timing difference" : i===2 ? "Possible unbooked swap or charges" : i===7 || i===8 ? "FX conversion timing in sample statement" : "No difference in the sample balance" }]));
export type ReconStatus = "SYNCED" | "DRIFT" | "STALE";
export type AdjustmentReason = "Pending funding" | "Unbooked swap" | "FX timing" | "Statement correction";
export const adjustmentReasons: AdjustmentReason[] = ["Pending funding","Unbooked swap","FX timing","Statement correction"];
export type FinanceAudit = { id:string; at:string; action:string; actor:"Local operator" | "Historical sample"; outcome:string; verification:string; ref?:string; detail:string; };
export type RailPolicyId = "mpesa" | "airtel" | "eft" | "crypto" | "card" | "ach" | "wire" | "cashier" | "manual" | "paper" | "internal";
export interface RailPolicy { id:RailPolicyId; title:string; currency:FundingCurrency; fee:number; min:number; max:number; enabled:boolean; detail:string; }
export const railPolicies: RailPolicy[] = [
  {id:"mpesa",title:"M-Pesa agents",currency:"KES",fee:25,min:500,max:100000,enabled:true,detail:"Kenya phone book and fictional agent preference"},
  {id:"airtel",title:"Airtel Money",currency:"KES",fee:35,min:500,max:75000,enabled:true,detail:"Review only · no linked Airtel adapter"},
  {id:"eft",title:"Kenya bank EFT",currency:"KES",fee:50,min:1000,max:250000,enabled:true,detail:"Review only · no live bank adapter"},
  {id:"crypto",title:"Crypto wallets",currency:"USDT",fee:0,min:10,max:20000,enabled:true,detail:"Profiles and network-specific fees are illustrative"},
  {id:"card",title:"Card processors",currency:"USD",fee:3,min:10,max:1000,enabled:true,detail:"Review only · no live card processor"},
  {id:"ach",title:"US bank ACH",currency:"USD",fee:0,min:25,max:25000,enabled:true,detail:"Alpaca sample bank flow"},
  {id:"wire",title:"Bank wire",currency:"USD",fee:15,min:100,max:50000,enabled:true,detail:"Manual wire proof"},
  {id:"cashier",title:"Hosted cashier",currency:"USD",fee:0,min:10,max:10000,enabled:true,detail:"Deriv hosted session preview"},
  {id:"manual",title:"Manual proof",currency:"USD",fee:0,min:10,max:50000,enabled:true,detail:"Receipt and funding reference review"},
  {id:"paper",title:"Paper funding",currency:"USD",fee:0,min:10,max:100000,enabled:true,detail:"Simulation only; no fee override for Paper"},
  {id:"internal",title:"Internal wallet",currency:"USDT",fee:0,min:10,max:20000,enabled:true,detail:"Binance funding wallet sample"},
];
export const kenyaBanks = ["KCB Bank", "Equity Bank", "Co-operative Bank", "Absa Bank Kenya", "Standard Chartered Kenya", "I&M Bank", "NCBA Bank", "DTB Kenya", "Family Bank", "Stanbic Bank"];
export const sampleProcessors = ["Sample card gateway A","Sample card gateway B"];
export const railDestinations = { mpesa:depositAgents.map(a=>a.name), airtel:["Airtel Money · Kenya"], eft:kenyaBanks, crypto:networkProfiles.map(n=>n.id), card:sampleProcessors, ach:["Sample checking •••• 1024"], wire:["Sample wire profile"], cashier:["Deriv hosted cashier"], manual:["Original funding route"], paper:["Local clearing"], internal:["Funding wallet","Spot wallet"] };
export type RailPreference = { accountId:string; rail:RailPolicyId; provider:string; label:string; masked:string; verified:boolean; };
const byBroker: Record<BrokerKey,RailPolicyId[]>={paper:["paper"],deriv:["cashier","mpesa","crypto","manual"],binance:["crypto","internal","manual"],alpaca:["ach","wire","manual"],exness:["manual"],ctrader:["manual"],oanda:["manual"],xm:["manual"],icmarkets:["manual"],pepperstone:["manual"]};
export const policyRailsFor = (broker:BrokerKey) => byBroker[broker];
