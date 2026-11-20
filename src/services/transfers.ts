import { publishNotice } from "./notificationStore";
import { readyMessage } from "@/data/accounts";
import { tradingAccounts, type TradingAccount } from "@/data/dashboard";
import type { FinanceEntryType, FinanceLedgerEntry, FundingCurrency } from "@/data/finance";
import { adjustmentReasons, balanceSnapshots, initialTransfers, ledgerTypes, transferRails, walletOptions, type AdjustmentReason, type FinanceAudit, type ReconStatus, type TransferRail, type TransferRecord, type Wallet } from "@/data/transfers";
import { getDepositHistory } from "./deposits";
import { getWithdrawalAudit } from "./withdrawals";
import { applyPaperTransfer, calculateWithdrawable, getAccounts, getLocalKillSwitch, getPaperOpeningBalance } from "./dashboard";
import { postFinanceLedger, readFinanceLedger } from "./financeLedger";
import { readFundingAudit } from "./fundingPolicy";
import { latency } from "./_latency";
export { adjustmentReasons, ledgerTypes, readyMessage, transferRails, walletOptions };
export type { FinanceEntryType, FinanceAudit, TransferRail, TransferRecord, Wallet, AdjustmentReason, TradingAccount };
const rows = structuredClone(initialTransfers);
const audit: FinanceAudit[] = [];
const checked = new Map<string,string>();
const resolutions = new Map<string,{note:string; ref:string}>();
let previewNightly = false, seq = 8700, adjSeq=9000;
const round = (n:number) => Math.round(n*100)/100;
const nowISO = () => new Date().toISOString();
export const eatDate = (iso:string) => new Date(Date.parse(iso)+10_800_000).toISOString().slice(0,10);
export const currentStatementMonth = () => eatDate(nowISO()).slice(0,7);
const effect = (row:FinanceLedgerEntry,id:string) => (+(row.creditAccountId===id) - +(row.debitAccountId===id))*row.amountUSD;
const seed = readFinanceLedger().filter(r=>r.origin === "Snapshot");
const openings = new Map(tradingAccounts.map(a=>[a.id,round(a.balance-seed.reduce((n,r)=>n+effect(r,a.id),0))]));
function opening(a:TradingAccount) { return openings.get(a.id) ?? getPaperOpeningBalance(a.id) ?? a.balance; }
const log = (event:Omit<FinanceAudit,"id"|"at"|"actor">) => audit.unshift({...event,id:crypto.randomUUID(),at:nowISO(),actor:"Local operator"});
function verifyTotp(code:string) { if (code !== "123456") throw new Error("Use example TOTP 123456. Do not enter a real code."); }
export const getTransferAccounts = () => getAccounts();
export const getTransferHistory = () => latency(rows);
export interface TransferInput { fromId:string; toId:string; rail:TransferRail; amount:number; key:string; fromWallet?:Wallet; toWallet?:Wallet; note?:string; reviewedLegs?:boolean; }
export function supportedTransferRails(from?:TradingAccount,to?:TradingAccount):TransferRail[] {
  if (!from || !to) return [];
  if (from.id===to.id) return from.broker==="binance"?["binance"]:[];
  if (from.broker==="paper" && to.broker==="paper") return ["paper"];
  if (from.broker==="deriv" && to.broker==="deriv") return ["deriv","manual"];
  if (["exness","icmarkets","pepperstone","xm"].includes(from.broker) && ["exness","icmarkets","pepperstone","xm"].includes(to.broker)) return ["mt5"];
  return ["manual"];
}
function quote(input:TransferInput, accounts:TradingAccount[]) {
  const from=accounts.find(a=>a.id===input.fromId), to=accounts.find(a=>a.id===input.toId);
  if (!from || !to || !supportedTransferRails(from,to).includes(input.rail)) throw new Error("This route is unavailable. Choose compatible accounts and a supported transfer rail.");
  if (getLocalKillSwitch()!=="armed") throw new Error("The workspace kill switch is active. Transfers are paused.");
  const min=input.rail==="paper"?1:10;
  if (!Number.isFinite(input.amount) || round(input.amount)!==input.amount || input.amount<min || input.amount>100000) throw new Error(`Enter ${min} to 100,000 with up to two decimals.`);
  if (input.amount>calculateWithdrawable(from).available) throw new Error("This exceeds the source's available balance or breaches its margin guard.");
  if (input.rail==="binance" && (!input.fromWallet || !input.toWallet || !walletOptions.includes(input.fromWallet) || !walletOptions.includes(input.toWallet) || input.fromWallet===input.toWallet)) throw new Error("Choose two different sample wallets for the Binance preview.");
  if ((input.note?.trim().length ?? 0)>140) throw new Error("Keep the optional draft note under 140 characters.");
  const currency = from.currency as FundingCurrency, toCurrency = to.currency as FundingCurrency;
  const twoLeg=input.rail==="mt5"||input.rail==="manual";
  const fee=twoLeg?4:0, fxRate=1;
  const legs:TransferRecord["legs"]=twoLeg?[
    {title:"Source withdrawal",accountLabel:from.label,gross:input.amount,currency,fee:2,eta:"1–2 business days",status:"Planned"},
    {title:"Destination deposit",accountLabel:to.label,gross:round((input.amount-2)*fxRate),currency:toCurrency,fee:2,eta:"1–3 business days after proof",status:"Waiting for leg 1"},
  ]:[{title:transferRails[input.rail].title,accountLabel:input.rail==="binance"?`${input.fromWallet} → ${input.toWallet}`:`${from.label} → ${to.label}`,gross:input.amount,currency,fee,eta:input.rail==="paper"?"Instant locally":"Usually instant · preview",status:"Planned"}];
  return { from,to,twoLeg,amount:input.amount,currency,toCurrency,fee,fxRate,received:round((input.amount-fee)*fxRate),legs };
}
export type TransferQuote = ReturnType<typeof quote>;
export async function previewTransfer(input:TransferInput) { return latency(quote(input,await getAccounts())); }
export async function requestTransfer(input:TransferInput & {totp:string}) {
  verifyTotp(input.totp);
  if (!input.key || input.key.length>100 || input.key.startsWith("sample-")) throw new Error("Missing a valid transfer request key.");
  const prior=()=>{
    const hit=rows.find(r=>r.idempotencyKey===input.key);
    if(hit&&(hit.accountId!==input.fromId||hit.toAccountId!==input.toId||hit.rail!==input.rail||hit.amountNative!==input.amount||(hit.rail==="binance"&&(hit.fromWallet!==input.fromWallet||hit.toWallet!==input.toWallet)))) throw new Error("This request key belongs to a different transfer.");
    return hit;
  };
  const existing=prior(); if(existing) return latency(existing);
  const accounts=await getAccounts();
  const repeated=prior(); if(repeated) return latency(repeated);
  const q=quote(input,accounts);
  if (q.twoLeg && !input.reviewedLegs) throw new Error("Review both manual legs and acknowledge the evidence handoff first.");
  const number=String(++seq).padStart(6,"0"), ref=`OS-FIN-${number}`, at=nowISO(), local=input.rail==="paper";
  const row:TransferRecord={id:crypto.randomUUID(),ref,type:"TRANSFER",rail:input.rail,accountId:q.from.id,accountLabel:q.from.label,broker:q.from.broker,toAccountId:q.to.id,toAccountLabel:q.to.label,toCurrency:q.toCurrency,currencyNative:q.currency,amountNative:q.amount,amountUSD:q.amount,creditNative:q.received,fee:q.fee,fxRate:q.fxRate,initiatedAt:at,origin:local?"Simulated":"Preview",status:local?"Posted":"Offline preview",idempotencyKey:input.key,fromWallet:input.rail==="binance"?input.fromWallet:undefined,toWallet:input.rail==="binance"?input.toWallet:undefined,legs:q.legs,ledgerRefs:[],note:local?"Two Paper balances updated in one local operation. No funds moved.":readyMessage};
  if (local) {
    const {sourceBalance,destinationBalance}=applyPaperTransfer(q.from.id,q.to.id,q.amount);
    const ledgerRef=`OS-LED-${number}`;
    row.settledAt=at; row.ledgerRef=ledgerRef; row.ledgerRefs=[ledgerRef]; row.legs=q.legs.map(leg=>({...leg,status:"Posted",ref:ledgerRef}));
    postFinanceLedger({id:ledgerRef,txType:"TRANSFER_OUT",debitAccountId:q.from.id,creditAccountId:q.to.id,currencyNative:"USD",amountNative:q.amount,amountUSD:q.amount,sourceRef:ref,accountLabel:q.from.label,postedAt:at,memo:"Paired local Paper transfer",origin:"Simulated",balanceAfterDebit:sourceBalance,balanceAfterCredit:destinationBalance});
  }
  rows.unshift(row);
  if (local) publishNotice({event:"transfer.completed",title:"Paper transfer posted",body:"Both Paper balances were updated in the local ledger. No funds moved.",ref:row.ref,id:`transfer.completed:${row.ref}`,accountLabel:row.accountLabel});
  log({action:local?"Paper transfer posted":"Transfer preview staged",outcome:local?"Simulated":"Offline",verification:"Example TOTP",ref,detail:`${q.from.label} → ${q.to.label} · ${q.currency} ${q.amount.toFixed(2)} · ${q.legs.length} leg${q.legs.length===1?"":"s"}.`});
  return latency(row);
}

function calculateRecon(accounts:TradingAccount[], ledger:FinanceLedgerEntry[]) {
  return accounts.map(a=>{
    const sample=balanceSnapshots[a.id];
    const local=a.broker==="paper";
    const internal=round(opening(a)+ledger.reduce((n,r)=>n+effect(r,a.id),0));
    const reported=local?a.balance:round(sample?.balance??a.balance);
    const difference=round(reported-internal);
    const capturedAt=local?nowISO():sample?.capturedAt??nowISO();
    const ageHours=Math.max(0,(Date.now()-Date.parse(capturedAt))/3600000);
    const status:ReconStatus=ageHours>=72?"STALE":Math.abs(difference)>=.01?"DRIFT":"SYNCED";
    return {accountId:a.id,label:a.label,broker:a.broker,kind:local?"Paper simulator":"Static broker fixture",internal,reported,difference,ageHours,capturedAt,lastChecked:checked.get(a.id),cause:Math.abs(difference)>=.01?(local?"Simulator and book differ; review entries before making a change.":sample?.cause??"Review the sample statement."):ageHours>=72?"Sample balance is more than 72 hours old.":"No difference at this snapshot.",status,resolution:resolutions.get(a.id)};
  });
}
export type ReconciliationRow = ReturnType<typeof calculateRecon>[number];
export async function getLedgerReconciliation() { const accounts=await getAccounts(); return latency({ rows:calculateRecon(accounts,readFinanceLedger()), previewNightly }); }
export async function runLedgerReconciliation(accountId?:string) {
  const accounts=await getAccounts(), apply=accounts.filter(a=>!accountId||a.id===accountId);
  if (!apply.length) throw new Error("Choose an available account.");
  const snapshot=nowISO(); apply.forEach(a=>checked.set(a.id,snapshot));
  const status=calculateRecon(apply,readFinanceLedger());
  log({action:"Reconciliation preview run",outcome:"Local snapshot",verification:"No money action",detail:`${apply.length} account(s) checked · ${status.filter(r=>r.status!=="SYNCED").length} flagged. No balance refreshed at a broker.`});
  return latency({ checked:apply.length,message:"Compared local snapshots only. No broker balances or transactions were fetched." });
}
export async function setReconciliationSchedule(enabled:boolean) {
  previewNightly=enabled;
  log({action:"Nightly reconciliation preference",outcome:"Preview only",verification:"No money action",detail:`Nightly comparison ${enabled?"enabled as a preference":"disabled"}; no worker, jobs or timers scheduled.`});
  return latency({enabled,message:enabled?"Preference saved. Nightly jobs require the backend; nothing was scheduled.":"Nightly preview preference disabled."});
}
export async function postLedgerAdjustment(input:{accountId:string; expectedDifference:number; reason:AdjustmentReason; note:string; totp:string}) {
  verifyTotp(input.totp);
  const note=input.note.trim();
  if (!adjustmentReasons.includes(input.reason)||note.length<12||note.length>240) throw new Error("Choose a reason and enter a 12–240 character note. Do not add secrets.");
  const a=(await getAccounts()).find(a=>a.id===input.accountId);
  if(!a || a.broker==="paper") throw new Error("Adjustments are supported only for broker sample books. Review simulator discrepancies in the ledger.");
  const item=calculateRecon([a],readFinanceLedger())[0];
  if (item.status!=="DRIFT" || item.difference!==input.expectedDifference) throw new Error("This drift changed or the snapshot is stale. Refresh reconciliation before posting.");
  const ref=`OS-ADJ-${String(++adjSeq).padStart(6,"0")}`, credit=item.difference>0;
  const clearing="sample-adjustment-clearing";
  postFinanceLedger({id:ref,txType:"ADJUSTMENT",debitAccountId:credit?clearing:a.id,creditAccountId:credit?a.id:clearing,amountNative:Math.abs(item.difference),amountUSD:Math.abs(item.difference),currencyNative:a.currency as FundingCurrency,sourceRef:ref,accountLabel:a.label,postedAt:nowISO(),memo:`${input.reason}: ${note}`,origin:"Simulated",...(credit?{balanceAfterCredit:item.reported}:{balanceAfterDebit:item.reported})});
  resolutions.set(a.id,{note:`${input.reason}: ${note}`,ref});
  log({action:"Reconciliation adjustment posted",outcome:"Local ledger only",verification:"Example TOTP",ref,detail:`${a.label} · ${item.difference.toFixed(2)} USD · ${input.reason}: ${note}`});
  return latency({ref,message:"Adjustment posted to the local book. No broker balance was changed."});
}

export async function getLedgerEntries() {
  const accounts=await getAccounts(), balances=new Map(accounts.map(a=>[a.id,opening(a)]));
  const labels=new Map(accounts.map(a=>[a.id,a.label]));
  const label=(id:string)=>{
    const [parent,wallet]=id.split(":");
    return labels.get(id)??(wallet&&labels.has(parent)?`${labels.get(parent)} · ${wallet}`:id.startsWith("sample-transfer-clearing")?"Sample transfer clearing":id.replace(/-/g," "));
  };
  const ledger=readFinanceLedger();
  const ordered=ledger.slice().reverse().map(r=>{
    const debit=balances.get(r.debitAccountId),credit=balances.get(r.creditAccountId);
    const debitAfter=debit===undefined?undefined:round(debit-r.amountUSD),creditAfter=credit===undefined?undefined:round(credit+r.amountUSD);
    if(debitAfter!==undefined) balances.set(r.debitAccountId,debitAfter);
    if(creditAfter!==undefined) balances.set(r.creditAccountId,creditAfter);
    return {...r,debitLabel:label(r.debitAccountId),creditLabel:label(r.creditAccountId),debitAfter,creditAfter};
  }).reverse();
  // A valid posting has both distinct sides and one positive, shared amount.
  const invalid=ledger.filter(r=>r.debitAccountId===r.creditAccountId||!r.debitAccountId||!r.creditAccountId||!Number.isFinite(r.amountUSD)||r.amountUSD<=0);
  const total=(side:"debitAccountId"|"creditAccountId")=>round(ledger.reduce((n,r)=>r[side]&&Number.isFinite(r.amountUSD)?n+r.amountUSD:n,0));
  const debits=total("debitAccountId"), credits=total("creditAccountId");
  return latency({rows:ordered,integrity:{balanced:invalid.length===0&&debits===credits,debits,credits,invalid:invalid.length}});
}
export type LedgerRow = Awaited<ReturnType<typeof getLedgerEntries>>["rows"][number];
export async function getLedgerOverview() {
  const accounts=await getAccounts(), ledger=readFinanceLedger(), recon=calculateRecon(accounts,ledger), today=eatDate(nowISO());
  const net=round(ledger.reduce((n,r)=>n+(r.txType==="DEPOSIT"?r.amountUSD:r.txType==="WITHDRAW"?-r.amountUSD:0),0));
  return latency({net,internal:round(recon.reduce((n,r)=>n+r.internal,0)),reported:round(recon.reduce((n,r)=>n+r.reported,0)),drift:round(recon.reduce((n,r)=>n+r.difference,0)),transfers:rows.filter(r=>r.status==="Posted"&&r.settledAt&&eatDate(r.settledAt).startsWith(today.slice(0,7))).length,entries:ledger.filter(r=>eatDate(r.postedAt)===today).length,synced:recon.filter(r=>r.status==="SYNCED").length,flagged:recon.filter(r=>r.status!=="SYNCED").length});
}
export async function getFinanceAudit() {
  const [deposits,withdrawals]=await Promise.all([getDepositHistory(),getWithdrawalAudit()]);
  const samples:FinanceAudit[]=initialTransfers.map(r=>({id:`audit-${r.id}`,at:r.initiatedAt,action:"Transfer history sample",actor:"Historical sample",outcome:r.status,verification:"Historical fixture",ref:r.ref,detail:`${r.accountLabel} → ${r.toAccountLabel} · ${r.legs.length} leg(s).`}));
  const depositEvents:FinanceAudit[]=deposits.filter(r=>r.origin!=="Snapshot").map(r=>({id:r.id,at:r.initiatedAt,action:"Deposit recorded",actor:"Local operator",outcome:r.origin,verification:"Local validation",ref:r.ref,detail:`${r.accountLabel} · ${r.currencyNative} ${r.amountNative.toFixed(2)}.`}));
  const withdrawalEvents:FinanceAudit[]=withdrawals.filter(r=>!r.id.startsWith("audit-withdrawal-sample-")).map(r=>({id:r.id,at:r.at,action:r.action,actor:"Local operator",outcome:r.outcome,verification:["Paper debit posted","Request staged"].includes(r.action)?"Example TOTP + OTP":r.action==="Safety policy updated"?"Example TOTP":r.action==="Destination staged"?"Example OTP":"Local preview",ref:r.ref,detail:`${r.request} · ${r.result}`}));
  return latency([...audit,...readFundingAudit(),...depositEvents,...withdrawalEvents,...samples].sort((a,b)=>b.at.localeCompare(a.at)));
}
const CSV = (rows:(string|number)[][]) => rows.map(r=>r.map(v=>typeof v==="number"?v:`"${(/^[=+@\-\t\r\n]/.test(v)?`'${v}`:v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
export async function exportTransferHistory(ids:string[]) {
  const selected=ids.flatMap(id=>rows.find(r=>r.id===id)??[]);
  if(!selected.length) throw new Error("No matching transfers.");
  return latency({filename:"ostrade-transfer-history.csv",text:CSV([["Reference","Date (EAT)","From","To","Rail","Amount","Currency","FX rate","Fee","Destination net","Status","Origin","Legs","Ledger refs"],...selected.map(r=>[r.ref,eatDate(r.initiatedAt),r.accountLabel,r.toAccountLabel,transferRails[r.rail].title,r.amountNative,r.currencyNative,r.fxRate,r.fee,r.creditNative,r.status,r.origin,r.legs.map(l=>`${l.title}: ${l.status}`).join("; "),r.ledgerRefs.join("; ")])])});
}
export async function exportLedgerEntries(ids:string[]) {
  const entries=(await getLedgerEntries()).rows;
  const selected=ids.flatMap(id=>entries.find(r=>r.id===id)??[]);
  if(!selected.length) throw new Error("No matching postings.");
  return latency({filename:"ostrade-double-entry-ledger.csv",text:CSV([["Entry","Date (EAT)","Type","Debit","Credit","Native amount","Currency","USD","Source","Debit running USD","Credit running USD","Origin","Memo"],...selected.map(r=>[r.id,eatDate(r.postedAt),ledgerTypes[r.txType],r.debitLabel,r.creditLabel,r.amountNative,r.currencyNative??"USD",r.amountUSD,r.sourceRef,r.debitAfter??"",r.creditAfter??"",r.origin,r.memo])])});
}

export async function getMonthlyStatement(input:{accountId:string; month:string}) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)||input.month>currentStatementMonth()) throw new Error("Choose a valid current or past month.");
  const a=(await getAccounts()).find(a=>a.id===input.accountId);
  if(!a) throw new Error("Choose an account to generate a statement.");
  const all=readFinanceLedger().filter(r=>r.creditAccountId===a.id||r.debitAccountId===a.id);
  const monthly=all.filter(r=>eatDate(r.postedAt).startsWith(input.month));
  const before=round(opening(a)+all.filter(r=>eatDate(r.postedAt).slice(0,7)<input.month).reduce((n,r)=>n+effect(r,a.id),0));
  const sum=(fn:(r:FinanceLedgerEntry)=>boolean)=>round(monthly.filter(fn).reduce((n,r)=>n+effect(r,a.id),0));
  const fees=(r:FinanceLedgerEntry)=>r.txType==="COMMISSION";
  const tradingNet=sum(r=>r.txType==="TRADE_PNL"||fees(r)||r.txType==="SWAP");
  return latency({accountId:a.id, label:a.label, month:input.month, currency:"USD", opening:before, deposits:sum(r=>r.txType==="DEPOSIT"), withdrawals:sum(r=>r.txType==="WITHDRAW"), transfers:sum(r=>r.txType==="TRANSFER_OUT"||r.txType==="TRANSFER_IN"), tradingNet, commissions:sum(fees), swaps:sum(r=>r.txType==="SWAP"), adjustments:sum(r=>["ADJUSTMENT","FX_GAIN","FX_LOSS"].includes(r.txType)), closing:round(before+sum(()=>true)), count:monthly.length, verified:false });
}
export type MonthlyStatement = Awaited<ReturnType<typeof getMonthlyStatement>>;
export async function exportMonthlyStatement(input:{accountId:string;month:string;format:"PDF"|"XLSX"}) {
  const s=await getMonthlyStatement(input);
  const data:[string,number|string][]=[["Account",s.label],["Month (EAT)",s.month],["Basis","Local preview - not broker verified"],["Opening balance (USD)",s.opening],["Deposits",s.deposits],["Withdrawals",s.withdrawals],["Transfers net",s.transfers],["Trading net (includes commission & swaps)",s.tradingNet],["Commission (included above)",s.commissions],["Swaps (included above)",s.swaps],["Adjustments and FX",s.adjustments],["Closing balance (USD)",s.closing],["Posting count",s.count]];
  let blob:Blob;
  if(input.format==="XLSX") {
    const {default:write}=await import("write-excel-file/browser");
    blob=await write([[{value:"Statement items",fontWeight:"bold"},{value:"Amount / detail",fontWeight:"bold"}],...data.map(r=>r.map(value=>({value})))],{columns:[{width:48},{width:45}]}).toBlob();
  } else {
    const {jsPDF}=await import("jspdf"); const doc=new jsPDF(); doc.setFontSize(22).text("OStrade | Monthly ledger statement",16,23); doc.setFontSize(10).text("Local snapshot and Paper activity. Not broker verified.",16,34); data.forEach(([label,value],i)=>doc.text(`${label}: ${typeof value==="number"?(label==="Posting count"?String(value):value.toFixed(2)):value}`,16,49+i*8)); blob=doc.output("blob");
  }
  return {blob,filename:`ostrade-${s.accountId}-${s.month}-statement.${input.format.toLowerCase()}`};
}
let signingKey:Promise<CryptoKey>|undefined;
const keyForAudit=()=>signingKey??=crypto.subtle.generateKey({name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
export async function exportSignedFinanceAudit() {
  const events=await getFinanceAudit();
  const body=JSON.stringify({schema:"ostrade-finance-audit-v1",generatedAt:nowISO(),authority:"Local session only; not a broker attestation",events});
  const bytes=await crypto.subtle.sign("HMAC",await keyForAudit(),new TextEncoder().encode(body));
  const hmac=Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,"0")).join("");
  return latency({filename:"ostrade-finance-audit-signed.json",text:JSON.stringify({algorithm:"HMAC-SHA-256",payload:body,hmac},null,2)});
}
export async function verifySignedFinanceAudit(file:File) {
  if(file.size>2_000_000) throw new Error("Choose a signed audit file under 2 MB.");
  let parsed:{algorithm?:unknown;payload?:unknown;hmac?:unknown};
  try { parsed=JSON.parse(await file.text()); } catch { throw new Error("This is not a valid audit JSON file."); }
  if(!parsed||parsed.algorithm!=="HMAC-SHA-256"||typeof parsed.payload!=="string"||typeof parsed.hmac!=="string"||!/^[a-f0-9]{64}$/.test(parsed.hmac)) throw new Error("Choose an OStrade signed audit export.");
  const tag=new Uint8Array(parsed.hmac.match(/../g)!.map(s=>parseInt(s,16)));
  const valid=await crypto.subtle.verify("HMAC",await keyForAudit(),tag,new TextEncoder().encode(parsed.payload));
  return latency({valid,message:valid?"Signature matches this browser session. This is not broker verification.":"Signature does not match. The file changed or came from a different session."});
}

export async function exportTransferReceipt(id:string) {
  const r=rows.find(row=>row.id===id);
  if(!r) throw new Error("Choose a transfer record.");
  const {jsPDF}=await import("jspdf"), doc=new jsPDF();
  doc.setFontSize(22).text("OStrade | Transfer record",16,23);
  doc.setFontSize(10).text(`${r.origin.toUpperCase()} - not a real payment receipt`,16,33);
  const parts=[r.ref,`${r.accountLabel} to ${r.toAccountLabel}`,`${r.currencyNative} ${r.amountNative.toFixed(2)} | FX ${r.fxRate.toFixed(4)} | fees ${r.fee.toFixed(2)} | Net ${r.toCurrency} ${r.creditNative.toFixed(2)}`,`Status: ${r.status} | ${eatDate(r.initiatedAt)} EAT`,...r.legs.map((l,i)=>`${i+1}. ${l.title} | ${l.status} | ${l.eta} | ${l.ref??"No external reference"}`),`Ledger: ${r.ledgerRefs.join(", ")||"No posting"}`,r.note];
  let y=48;
  for(const part of parts) { const lines=doc.splitTextToSize(part,174) as string[]; doc.text(lines,16,y); y+=7*lines.length+3; }
  return {blob:doc.output("blob"),filename:`ostrade-${r.ref.toLowerCase()}-transfer.pdf`};
}
