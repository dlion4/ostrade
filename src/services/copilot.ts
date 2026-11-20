import { publishNotice } from "./notificationStore";
import { readyMessage } from "@/data/accounts";
import { tradingAccounts, type TradingAccount } from "@/data/dashboard";
import { marketSymbols, symbolAliases } from "@/data/markets";
import { briefingDefaults, copilotTemplates, initialApproval, promptExamples, anomalyFixtures, seedAudit, seedThreads, type ActionClass, type ActionPayload, type ActionReceipt, type ApprovalMode, type ApprovalPolicy, type BriefingSettings, type CopilotAudit, type CopilotDraft, type CopilotMessage, type CopilotThread, type DraftObject, type ToolActivity } from "@/data/copilot";
import { closePosition, getAccounts, getCopilotProposals, getEconomicEvents, getLocalKillSwitch, getPositions, getSignalRules, placeDashboardOrder, saveSignalRule, setSignalRuleEnabled, updatePositionStops } from "./dashboard";
import { defaultRuleDraft, saveAutomationRule } from "./automation";
import { createCopilotScheduleDrafts, getSchedulerSchedules } from "./scheduler";
import { mappedBrokerSymbol, saveAccountSymbolOverrides } from "./symbolMappings";
import { eatDay, getTradeRecords, netPnl } from "./records";
import { getLedgerOverview } from "./transfers";
import { latency } from "./_latency";
export type { ActionClass, ActionReceipt, ApprovalMode, ApprovalPolicy, BriefingSettings, CopilotAudit, CopilotDraft, CopilotMessage, CopilotThread, DraftObject, Severity, Template, ToolActivity } from "@/data/copilot";
export { promptExamples, readyMessage };
const uid=(prefix:string)=>`${prefix}-${crypto.randomUUID().slice(0,12)}`;
const now=()=>new Date().toISOString();
const money=(n:number)=>`${n<0?"−":""}$${Math.abs(n).toFixed(2)}`;
const threads=structuredClone(seedThreads), drafts:CopilotDraft[]=[], activity=structuredClone(seedAudit);
let briefingSettings=structuredClone(briefingDefaults), autoMitigate=false;
const policy=structuredClone(initialApproval), reviewed=new Map<string,{status:"Reviewed"|"Mitigated";message:string}>();
const guardDrafts:{ref:string;object:DraftObject;accountId:string}[]=[];
let seeded=false;
let seedJob:Promise<void>|undefined;
const log=(row:Omit<CopilotAudit,"id"|"at"|"source">)=>activity.unshift({...row,id:uid("ai-audit"),at:now(),source:"Session"});
function totp(code?:string){if(code!=="123456")throw new Error("Use example TOTP 123456. Do not enter a real code.");}
function createDraft(account:TradingAccount, data:Omit<CopilotDraft,"id"|"createdAt"|"accountId"|"accountLabel"|"broker"|"status"|"receipt">){
  const value:CopilotDraft={...data,id:uid("AI"),createdAt:now(),accountId:account.id,accountLabel:account.label,broker:account.broker,status:"Pending",receipt:[]};
  drafts.unshift(value);
  if(value.source!=="Sample")publishNotice({event:"copilot.proposal",id:`proposal:${value.id}`,title:`Proposal ready · ${value.title}`,body:'A local proposal is waiting for operator review. Nothing executed.',accountLabel:value.accountLabel,ref:value.id});
  return value;
}
async function ensureSamples(){
  if(seeded)return;
  seedJob??=(async()=>{const fixtures=await getCopilotProposals();
    for(const f of fixtures.slice().reverse()){
      const a=tradingAccounts.find(o=>o.id===f.accountId); if(!a)continue;
      const previewClass:ActionClass=f.id==="ai-03"||f.id==="ai-08"?"position.close":f.id==="ai-04"?"schedule.create":f.id==="ai-01"||f.id==="ai-06"?"position.modify":"guard.set";
      createDraft(a,{title:f.title,summary:f.rationale,args:f.proposedAction,classes:[previewClass],source:"Sample",confidence:f.confidence,payload:{type:"preview",summary:"Historical suggestion; the original inputs are not executable. Open the relevant workstation to prepare a current action."}});
    }seeded=true;})();await seedJob;
}
export async function getCopilotDrafts(){await ensureSamples(); return latency(drafts);}
export const getCopilotTemplates=()=>latency(copilotTemplates);
export const getCopilotThreads=()=>latency(threads);
export const getCopilotActivity=()=>latency(activity);
export const getCopilotPolicy=()=>latency({policy,autoMitigate});
export const getCopilotAccounts=()=>getAccounts();
export const getBriefingSettings=()=>latency(briefingSettings);
export const getMapperCatalog=()=>latency({accounts:tradingAccounts.map(a=>({id:a.id,label:a.label,broker:a.broker})),symbols:marketSymbols.map(s=>s.canonical)});
export async function getCopilotOverview(){
  const examples=activity.filter(a=>a.source==="Fixture");
  const accepted=examples.filter(a=>a.approved).length+drafts.filter(d=>["Simulated","Drafts saved","Offline preview"].includes(d.status)).length;
  const rejected=examples.filter(a=>a.approval==="Rejected").length+drafts.filter(d=>d.status==="Rejected").length;
  return latency({actions:activity.filter(a=>a.approved).length,accepted,rejected,anomalies:anomalyFixtures.filter(a=>a.hours<168&&Math.max(...a.series)>a.threshold).length,overrides:activity.filter(a=>a.override).length});
}
export async function setCopilotPolicy(input:{action:ActionClass;mode:ApprovalMode;inline2FA:boolean;code?:string}){
  const item=policy.find(a=>a.action===input.action);
  if(!item||input.action==="finance.*")throw new Error("Finance is locked to Always ask. No funds move through Co-Pilot.");
  if(!["Always ask","Standing","Never"].includes(input.mode)||typeof input.inline2FA!=="boolean")throw new Error("Choose a valid approval mode.");
  if(item.mode!==input.mode&&(input.mode==="Standing"||item.mode==="Never")||item.inline2FA&&!input.inline2FA)totp(input.code);
  const old=item.mode; item.mode=input.mode;item.inline2FA=input.inline2FA;
  log({tool:"policy.update",args:`${item.action}: ${old} → ${item.mode}; inline 2FA ${item.inline2FA?"on":"off"}`,outcome:"Local policy saved",approval:"Inline",approved:true,refs:[],override:old!==item.mode});
  return latency(item);
}
export async function setAutoMitigation(input:{enabled:boolean;code?:string}){
  if(input.enabled)totp(input.code);
  autoMitigate=input.enabled;
  log({tool:"policy.auto_mitigate",args:"Single scoped Paper-rule pause on manual scan only",outcome:autoMitigate?"Enabled locally":"Disabled",approval:"Inline",approved:true,refs:[]});
  return latency({enabled:autoMitigate});
}
const installClasses=(objects:DraftObject[])=>[...new Set(objects.map(o=>o.kind==="schedule"?"schedule.create" as const:o.kind==="rule"?"rule.create" as const:"guard.set" as const))];
export async function prepareCopilotTemplate(input:{templateId:string;accountId?:string}){
  const t=copilotTemplates.find(x=>x.id===input.templateId); if(!t)throw new Error("Template unavailable.");
  const a=(await getAccounts()).find(x=>x.broker===t.target&&(!input.accountId||x.id===input.accountId));if(!a)throw new Error(`Choose a ${t.target} account for this template.`);
  const existing=drafts.find(d=>d.sourceKey===`${t.id}:${a.id}`&&["Pending","Running","Drafts saved"].includes(d.status));
  if(existing)return latency(existing);
  const draft=createDraft(a,{title:t.name,summary:t.risk,args:`${t.objects.length} reviewed object(s) · ${a.label}`,classes:installClasses(t.objects),source:"Template",sourceKey:`${t.id}:${a.id}`,payload:{type:"install",objects:structuredClone(t.objects),templateId:t.id}});
  return latency(draft);
}
export async function newCopilotThread(){
  const thread:CopilotThread={id:uid("thread"),title:"New workspace chat",createdAt:now(),messages:[]};threads.unshift(thread);return latency(thread);
}
const sanitized=(text:string)=>text.replace(/\b(?:https?|wss?):\/\/\S+/gi,"[redacted URL]").replace(/\b(?:password|secret|(?:api[ _-]?)?(?:token|key)|authorization|bearer|otp)\s*(?:[:=]\s*|\s+)[^\s,;]+/gi,"[redacted credential]").replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,"[redacted email]").replace(/\b[A-Za-z0-9_-]{30,}\b/g,"[redacted identifier]");
function findInstrument(raw:string){
  const text=raw.trim().toLowerCase();
  for(const item of marketSymbols){if(new RegExp(`(?:^|[^a-z0-9_])${item.canonical.toLowerCase()}(?:$|[^a-z0-9_])`).test(text)) return item;}
  const alias=Object.keys(symbolAliases).sort((a,b)=>b.length-a.length).find(a=>new RegExp(`(?:^|[^a-z0-9_])${a}(?:$|[^a-z0-9_])`).test(text));
  return alias?marketSymbols.find(s=>s.canonical===symbolAliases[alias]):undefined;
}
const brokerScopes = ["exness","deriv","binance","alpaca","paper","oanda","ctrader","icmarkets","ic markets","xm","pepperstone"];
function pickScope(text:string,accounts:TradingAccount[],selected:TradingAccount){
  const command=text.replace(/[.!?]$/, "").trim();
  const scopes=[...command.matchAll(/\bon\s+/gi)];
  if(!scopes.length)return {account:selected,command};
  if(scopes.length!==1)return undefined;
  const scope=scopes[0], phrase=command.slice(scope.index+scope[0].length).trim().toLowerCase();
  const body=command.slice(0,scope.index).trim();
  const labels:Record<string,string>={"paper main":"acc-paper-main","paper reserve":"acc-paper-reserve","exness raw":"acc-exness-raw","exness trial":"acc-exness-trial","deriv demo":"acc-deriv-demo","deriv real":"acc-deriv-live"};
  const exact=accounts.filter(a=>a.label.toLowerCase()===phrase||a.id===labels[phrase]);
  if(exact.length===1)return {account:exact[0],command:body};
  if(!brokerScopes.includes(phrase))return undefined;
  const broker=phrase.replace(/ /g,""), matches=accounts.filter(a=>a.broker===broker);
  if(selected.broker===broker)return {account:selected,command:body};
  return matches.length===1?{account:matches[0],command:body}:undefined;
}
const trace=(name:string,args:string,result:string,kind:ToolActivity["kind"]="Read"):ToolActivity=>({name,args,result,kind});
function createScheduleObjects(symbol:string,count:number,interval:number,stake:number,maxOpen:number,session:string,direction:"BUY"|"SELL"):DraftObject[]{
  return Array.from({length:count},(_,i)=>({kind:"schedule",name:`${symbol} ${session} slot ${String(i+1).padStart(2,"0")}`,symbol,detail:`${session} open +${i*interval}m · slot ${i+1}/${count} · ${interval}m spacing · max ${maxOpen} open`,size:`${stake} USD stake`,trigger:"session",strategy:"entry",direction,maxOpen}));
}
function validOrder(side:"BUY"|"SELL",size:number,entry:number,sl:number,tp:number){return [size,entry,sl,tp].every(n=>Number.isFinite(n)&&n>0&&n<1e8)&&size<=10&&(side==="BUY"?sl<entry&&tp>entry:sl>entry&&tp<entry);}
async function interpret(text:string,account:TradingAccount,threadId:string):Promise<{text:string;tools:ToolActivity[];draft?:CopilotDraft}>{
  const q=text.toLowerCase(), symbol=findInstrument(text);
  const plan=(title:string,summary:string,classes:ActionClass[],payload:ActionPayload,args:string,tool:string=classes[0])=>{
    const draft=createDraft(account,{title,summary,classes,payload,args,source:"Chat",threadId});
    return {text:`${summary} Nothing has executed. Review the proposal before continuing.`,tools:[trace(tool,args,"Approval required · no dispatch","Review")],draft};
  };
  const clarify=(message:string)=>({text:message,tools:[]});
  if(/\b(?:do not|don't|never|explain how to)\b/.test(q))return clarify("No action drafted. For an explicit local preview, use one of the sample prompt formats.");
  if(text.includes("[redacted"))return clarify("Sensitive-looking text was removed. Rephrase using sample values without credentials, links, or contact details.");
  if(/\b(deposit|withdraw|transfer|send money)\b/.test(q)&&!/\b(summarize|summary|ledger|balance)\b/.test(q))return plan("Finance request review","Finance requires inline approval and remains offline. Use the dedicated Finance workspace for any complete preview.",["finance.*"],{type:"preview",summary:"No finance instructions, destinations, or funds were sent."},`${account.label} · finance review only`);
  if(/\b(?:move|set)\b.*\bstop\b.*\bbreakeven\b/.test(q)){
    if(!symbol)return clarify("Specify a mapped symbol and scope for a breakeven review.");
    const eligible=(await getPositions({accountId:account.id})).filter(p=>p.symbol===symbol.canonical&&p.pnl>0&&p.tp>0&&(p.side==="BUY"?p.current>p.entry&&p.sl<p.entry:p.current<p.entry&&p.sl>p.entry));
    if(eligible.length!==1)return clarify("A breakeven review needs exactly one eligible profitable position on the selected account. Review open positions first.");
    const pos=eligible[0];
    return plan(`Review breakeven for ${pos.symbol}`,`Move the stop to entry for ${pos.ref} on ${account.label}.`,["position.modify"],{type:"modify",id:pos.id,ref:pos.ref,sl:pos.entry,tp:pos.tp},`${pos.ref} · SL ${pos.sl} → ${pos.entry} · TP unchanged`);
  }
  if(/\bclose\b/.test(q)&&/\bpositions?\b/.test(q)){
    const request=q.match(/^close\s+(?:(?:all|every)\s+)?([a-z0-9_ ]+?)\s+positions?\s+losing\s+(?:more than|over|greater than)\s*\$?(\d+(?:\.\d+)?)(?:\s+usd)?$/);
    const code=request?.[1],loss=Number(request?.[2]);
    if(!symbol||!code||(symbol.canonical.toLowerCase()!==code&&symbolAliases[code]!==symbol.canonical)||!Number.isFinite(loss)||loss<=0)return clarify("Specify one instrument and a positive loss threshold, such as “Close EURUSD positions losing more than $50.” Choose an exact account in Scope if needed.");
    const found=(await getPositions({accountId:account.id})).filter(p=>p.symbol===symbol.canonical&&p.pnl< -loss);
    if(!found.length)return {text:`No ${symbol.canonical} positions on ${account.label} are losing more than ${money(loss)} in the current snapshot. No close proposal was generated.`,tools:[trace("positions.list",`${account.label} · ${symbol.canonical}` ,"No matching positions")]};
    return plan(`Review ${found.length} ${symbol.canonical} close${found.length===1?"":"s"}`,`${found.length} selected position(s) on ${account.label} match this loss threshold.`,["position.close"],{type:"close",ids:found.map(p=>p.id),refs:found.map(p=>p.ref),symbol:symbol.canonical,lossOnly:loss},`${found.map(p=>`${p.ref} ${money(p.pnl)}`).join(" · ")} · Frozen scope`);
  }
  if(/\bschedules?\b/.test(q)&&/\b(create|schedule|build)\b/.test(q)){
    const cnt=q.match(/\bcreate\s+(\d+)\s+schedules?/), gap=q.match(/every\s+(\d+)\s*(?:min|m\b)/), stake=q.match(/(?:with|stake)\s+(\d+(?:\.\d+)?)\s*(?:usd|dollars)/), max=q.match(/max\s+(\d+)\s+open/), session=q.match(/\b(london|new york|asia)\b/)?.[1];
    if(!cnt||!gap||!stake||!max||!session||!symbol||!['paper','deriv'].includes(account.broker)||+cnt[1]<1||+cnt[1]>20||+gap[1]<5||+gap[1]>120||+stake[1]<1||+stake[1]>100||+max[1]<1||+max[1]>10||!mappedBrokerSymbol(symbol,account))return clarify("Use a mapped Paper or Deriv symbol, 1–20 schedules, 5–120 minutes, 1–100 USD stake, a session and a 1–10 open-position limit. Try the London example.");
    if((+cnt[1]-1)*+gap[1]>=480)return clarify("The proposed slots exceed an eight-hour sample session. Reduce count or spacing.");
    const objects=createScheduleObjects(symbol.canonical,+cnt[1],+gap[1],+stake[1],+max[1],session.replace(/\b\w/g,c=>c.toUpperCase()),/\b(sell|fall)\b/.test(q)?"SELL":"BUY");
    return plan(`Review ${objects.length} ${symbol.canonical} schedules`,`I prepared ${objects.length} paused review slots for ${account.label}, with ${gap[1]}-minute spacing and a recorded max-open limit of ${max[1]}.`,["schedule.create"],{type:"install",objects},`${objects.length} rows · ${symbol.canonical} · max ${max[1]} open`);
  }
  if(/\bguard\b/.test(q)&&/\bloss\b/.test(q)){
    const pct=q.match(/\b(\d+(?:\.\d+)?)\s*%/);
    if(!pct||+pct[1]<.5||+pct[1]>20)return clarify("Specify a sample daily loss threshold from 0.5% to 20%.");
    const guard:DraftObject={kind:"guard",name:"Daily loss guard",symbol:"WORKSPACE",threshold:+pct[1],detail:`Propose pausing automation when the daily loss exceeds ${pct[1]}%. Advisory only.`};
    return plan("Draft a daily loss guard",`${guard.detail} Approval records a draft; it does not change the kill switch.`,["guard.set"],{type:"install",objects:[guard]},`${pct[1]}% daily loss · guard draft`);
  }
  const order=q.match(/^\s*(buy|sell)\s+(\d+(?:\.\d+)?)\s*(lots?|shares?|stake)\s+([a-z0-9_]+)\s+at\s+(\d+(?:\.\d+)?)\s+sl\s+(\d+(?:\.\d+)?)\s+tp\s+(\d+(?:\.\d+)?)\s*$/i);
  if(order){
    const [,side,size,unit,code,entry,sl,tp]=order;const item=marketSymbols.find(s=>s.canonical===code.toUpperCase());const direction=side.toUpperCase() as "BUY"|"SELL";
    if(!item||!mappedBrokerSymbol(item,account)||!validOrder(direction,+size,+entry,+sl,+tp))return clarify("This order is not reviewable. Use a mapped symbol, size up to 10, and protective levels on the correct side of the entry.");
    return plan(`Review ${direction} ${item.canonical}`,`Validated the explicit sample order for ${account.label}. ${account.broker==="paper"?"Approval uses the local simulator.":"Broker execution stays offline."}`,["order.place"],{type:"order",symbol:item.canonical,side:direction,size:+size,unit:unit.startsWith("lot")?"lots":unit.startsWith("share")?"shares":"stake",entry:+entry,sl:+sl,tp:+tp},`${direction} ${size} ${unit} · ${item.canonical} @ ${entry} · SL ${sl} · TP ${tp}`,"order.preview");
  }
  if(/\b(?:create|draft)\b.*\brule\b/.test(q)){
    if(!symbol||!mappedBrokerSymbol(symbol,account))return clarify("Name one mapped symbol to draft a local rule with stops required.");
    const rule:DraftObject={kind:"rule",name:`${symbol.canonical} signal review`,symbol:symbol.canonical,detail:"Telegram sample allow-list · require SL · maximum 3 open · disabled draft",strategy:"entry"};
    return plan(rule.name,"Prepared one disabled signal rule for review.",["rule.create"],{type:"install",objects:[rule]},`${symbol.canonical} · disabled rule`);
  }
  if(/\b(week|rank|performance)\b/.test(q)){
    const lookback=Date.now()-7*86400000;const trades=(await getTradeRecords()).filter(r=>Date.parse(r.closedAt)>=lookback&&Date.parse(r.closedAt)<=Date.now());
    const totals=new Map<string,number>();trades.forEach(r=>{const key=r.sourceName||r.source;totals.set(key,(totals.get(key)??0)+netPnl(r));});
    const ranked=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,3);
    return {text:`The local journal has ${trades.length} closed trades in the last 7 days, net ${money(trades.reduce((n,r)=>n+netPnl(r),0))}. ${ranked.length?`Top recorded sources: ${ranked.map(([s,n])=>`${s} (${money(n)})`).join(", ")}.`:"No sources to rank."} Sample results are not forecasts.`,tools:[trace("records.query","Workspace · last 7 days",`${trades.length} closed trade records`),trace("signal.rank","Group realized results by source",`${ranked.length} ranked source summaries`)]};
  }
  if(/\bledger\b/.test(q)){const info=await getLedgerOverview();return {text:`Local ledger: net funding ${money(info.net)}, ${info.entries} postings today, and ${info.flagged} accounts flagged for drift or stale snapshots. No money moved.`,tools:[trace("ledger.query","Workspace · read-only summary",`${info.entries} postings today`)]};}
  if(/\b(balance|account summary|equity)\b/.test(q))return {text:`${account.label}: balance ${money(account.balance)}, equity ${money(account.equity)}, margin ${account.marginUsedPct.toFixed(1)}%. Static snapshot, not a broker connection.`,tools:[trace("account.summary",account.label,"Snapshot reviewed")]};
  if(symbol&&/quote|price|bid|ask|spread/.test(q))return {text:`${symbol.canonical} snapshot bid: ${symbol.bid.toFixed(symbol.digits)}. No live tick or broker price was requested.`,tools:[trace("quotes.get",symbol.canonical,"Static market catalog") ]};
  return clarify("I can compare snapshots, rank journal sources, or draft a schedule, guard, or explicit order for approval. Try a sample prompt. Unsupported requests are not executed.");
}
export async function sendCopilotMessage(input:{threadId:string;accountId:string;text:string}){
  const clean=input.text.trim();if(!clean||clean.length>900)throw new Error("Enter a message up to 900 characters.");
  const thread=threads.find(t=>t.id===input.threadId&&t.id!=="sample-thread");if(!thread)throw new Error("Start a local conversation first.");
  const accounts=await getAccounts(),selected=accounts.find(a=>a.id===input.accountId);if(!selected)throw new Error("Choose a valid account scope.");
  const redacted=sanitized(clean),scope=pickScope(redacted,accounts,selected);
  const data=scope?await interpret(redacted.includes("[redacted")?redacted:scope.command,scope.account,thread.id):{text:"The account scope is unknown or ambiguous. Choose one profile in Scope and refer to its exact label after “on”, or omit the account name. No proposal was prepared.",tools:[],draft:undefined};
  const user:CopilotMessage={id:uid("msg"),role:"operator",text:redacted,at:now()};
  const reply:CopilotMessage={id:uid("msg"),role:"assistant",text:data.text,at:now(),tools:data.tools,proposalId:data.draft?.id};
  if(!thread.messages.length)thread.title=data.draft?.title??(data.tools[0]?.name?`${data.tools[0].name} review`:"Workspace chat");
  thread.messages.push(user,reply);
  for(const t of data.tools)log({threadId:thread.id,tool:t.name,args:t.args,outcome:t.result,approval:"Read only",approved:false,refs:[]});
  return latency({thread,proposal:data.draft});
}

export function approvalRequirements(draft:CopilotDraft,rules:ApprovalPolicy[]){
  const matches=draft.classes.map(c=>rules.find(r=>r.action===c));
  const blocked=matches.some(r=>!r||r.mode==="Never");
  const standing=!blocked&&draft.broker==="paper"&&matches.every(r=>r?.mode==="Standing");
  return {blocked,standing,code:!standing&&matches.some(r=>r?.inline2FA||r?.action==="finance.*")};
}
async function executeDraft(draft:CopilotDraft,a:TradingAccount):Promise<{status:CopilotDraft["status"];message:string;refs:ActionReceipt[]}> {
  const p=draft.payload;
  const offline=(message:string)=>({status:"Offline preview" as const,message,refs:[{ref:`AI-PREVIEW-${draft.id.slice(-7)}`,kind:"preview" as const,label:"Local preview only"}]});
  if(p.type==="preview")return offline(`${readyMessage}. ${p.summary}`);
  if(p.type==="install"){
    const {objects,templateId}=p; const refs:ActionReceipt[]=[];
    const scheduleRows=objects.filter(o=>o.kind==="schedule"), ruleRows=objects.filter(o=>o.kind==="rule");
    if(scheduleRows.length&&ruleRows.length)throw new Error("Mixed schedule and rule batches are not enabled in this preview.");
    if(scheduleRows.length){
      if(a.broker!=="paper"&&a.broker!=="deriv")throw new Error("This schedule batch is not compatible with the selected profile.");
      const created=await createCopilotScheduleDrafts(scheduleRows.map(o=>({name:o.name,trigger:o.trigger??"one_time",triggerDetail:o.detail,accountId:a.id,accountLabel:a.label,broker:a.broker==="deriv"?"deriv":"paper",brokerLabel:a.brokerName,symbol:o.symbol,side:o.direction??"BUY",size:o.size??"Preview only",sl:"Review before activation",tp:"Review before activation",tags:templateId?[templateId]:["chat"],copilot:{source:"AI",templateId,intent:o.strategy??"entry",maxOpen:o.maxOpen}})));
      refs.push(...created.map(r=>({ref:r.ref,kind:"schedule" as const,label:r.name})));
    }
    if(ruleRows.length){
      const o=ruleRows[0];
      // Breakeven is not a signal-entry action. Preserve it as a disabled template intent.
      const meta={source:"AI" as const,templateId,intent:o.strategy??"entry"};
      const created=o.strategy==="breakeven"?await saveSignalRule({name:o.name,source:"Telegram",channel:"Preview only",conditionSummary:o.detail,accountId:a.id,accountLabel:a.label,enabled:false,copilot:meta}):await saveAutomationRule({...defaultRuleDraft([a]),name:o.name,description:o.detail,accountIds:[a.id],symbols:[o.symbol],channels:["Synthetic Signals KE"],sizeValue:0.05,maxOpenPositions:3,dailyLossPct:3,copilot:meta},false);
      refs.push({ref:created.id,kind:"rule",label:created.name});
    }
    for(const o of objects.filter(o=>o.kind==="guard")){const ref=uid("AI-GUARD");guardDrafts.unshift({ref,object:o,accountId:a.id});refs.push({ref,kind:"guard",label:o.name});}
    return {status:"Drafts saved",message:`${refs.length} local draft${refs.length===1?"":"s"} saved. Schedules stay paused, rules disabled, and guards advisory. No jobs or broker calls started.`,refs};
  }
  if(p.type==="order"){
    const item=marketSymbols.find(s=>s.canonical===p.symbol);
    if(!item||!mappedBrokerSymbol(item,a)||!validOrder(p.side,p.size,p.entry,p.sl,p.tp))throw new Error("The reviewed order no longer passes the account or sizing guard.");
    const res=await placeDashboardOrder({accountId:a.id,symbol:p.symbol,side:p.side,size:p.size,entry:p.entry,sl:p.sl,tp:p.tp,sizeUnit:p.unit,sourceRef:draft.id,sourceLabel:"AI Co-Pilot · reviewed",origin:"Co-Pilot"});
    if(res.mode==="ready")return offline(`${readyMessage}. No broker request was sent.`);
    if(res.mode!=="simulated")throw new Error(res.detail||"Paper fill blocked.");
    return {status:"Simulated",message:res.detail,refs:[{ref:res.ref,kind:"order",label:`${p.side} ${p.symbol}`}]};
  }
  if(a.broker!=="paper"||a.environment!=="paper")return offline(`${readyMessage}. No broker request was sent.`);
  if(p.type==="pause"){
    const rule=(await getSignalRules()).find(r=>r.id===p.ruleId&&r.accountId===a.id);
    if(!rule||!rule.enabled)throw new Error("The reviewed Paper rule is missing or already paused.");
    await setSignalRuleEnabled(rule.id,false);
    return {status:"Simulated",message:`Paused ${rule.name} locally. No other rule or position changed.`,refs:[{ref:rule.id,kind:"rule",label:rule.name}]};
  }
  if(getLocalKillSwitch()!=="armed")throw new Error("The workspace kill switch is active. Create a fresh review after re-arming.");
  const positions=await getPositions({accountId:a.id});
  if(getLocalKillSwitch()!=="armed")throw new Error("The workspace kill switch is active. No positions changed.");
  if(p.type==="modify"){
    const pos=positions.find(x=>x.id===p.id&&x.ref===p.ref&&x.broker==="paper");
    if(!pos||p.sl!==pos.entry||p.tp!==pos.tp||pos.pnl<=0||!(pos.side==="BUY"?pos.current>p.sl&&pos.sl<p.sl:pos.current<p.sl&&pos.sl>p.sl))throw new Error("The reviewed position or its risk levels changed. No stop was moved.");
    const result=await updatePositionStops(pos.id,p.sl,p.tp);
    if(result.mode!=="simulated")throw new Error(result.detail||result.title);
    return {status:"Simulated",message:result.detail,refs:[{ref:pos.ref,kind:"position",label:`${pos.symbol} stops`}]};
  }
  const target=p.ids.map(id=>positions.find(x=>x.id===id&&x.broker==="paper"&&x.symbol===p.symbol&&(p.lossOnly===undefined||x.pnl< -p.lossOnly)));
  if(!target.length||target.some(x=>!x))throw new Error("Position state changed. Recreate the proposal so you can review its current scope.");
  const results=await Promise.all(target.map(x=>closePosition(x!.id)));
  const refs=results.flatMap((r,i):ActionReceipt[]=>r.mode==="simulated"?[{ref:r.ref,kind:"position",label:`${target[i]?.symbol} closed`}]:[]);
  if(!refs.length)throw new Error("No eligible positions were closed.");
  return {status:"Simulated",message:`${refs.length} of ${results.length} reviewed positions closed on Paper. No external positions changed.`,refs};
}
export async function decideCopilotDraft(input:{id:string;decision:"approve"|"reject";code?:string}){
  if(!["approve","reject"].includes(input.decision))throw new Error("Choose approve or reject.");
  const draft=drafts.find(d=>d.id===input.id); if(!draft)throw new Error("This proposal is unavailable.");
  if(draft.status!=="Pending")return latency(draft);
  const base={threadId:draft.threadId,tool:draft.classes.join(" + "),args:draft.args};
  if(input.decision==="reject"){
    draft.status="Rejected";draft.outcome="Rejected by operator. Nothing executed.";
    log({...base,outcome:draft.outcome,approval:"Rejected",approved:false,refs:[],override:true});return latency(draft);
  }
  const need=approvalRequirements(draft,policy);
  if(need.blocked){
    draft.status="Blocked";draft.outcome="Blocked by current approval policy. Nothing executed.";
    log({...base,outcome:draft.outcome,approval:"Blocked",approved:false,refs:[]});return latency(draft);
  }
  if(need.code&&input.code!=="123456"){
    log({...base,outcome:"Approval denied: example authenticator check failed. Proposal remains pending.",approval:"Blocked",approved:false,refs:[]});
    totp(input.code);
  }
  draft.status="Running";
  try{
    const account=(await getAccounts()).find(a=>a.id===draft.accountId);
    if(!account)throw new Error("The reviewed account is no longer available.");
    const current=approvalRequirements(draft,policy);
    if(current.blocked||(current.code&&input.code!=="123456"))throw new Error("Approval policy changed. No action was executed.");
    const result=await executeDraft(draft,account);
    draft.status=result.status;draft.outcome=result.message;draft.receipt=result.refs;
    log({...base,outcome:result.message,approval:current.standing?"Standing":"Inline",approved:true,refs:result.refs});
  }catch(e){draft.status="Blocked";draft.outcome=e instanceof Error?e.message:"Local action could not complete.";log({...base,outcome:draft.outcome,approval:"Blocked",approved:false,refs:[]});}
  return latency(draft);
}

export type MappingCandidate={id:string;text:string;canonical:string;brokerSymbol:string;confidence:"High"|"Medium"|"Needs confirmation";reason:string};
export async function mapCopilotSymbols(input:{accountId:string;text:string}){
  const account=tradingAccounts.find(a=>a.id===input.accountId); if(!account)throw new Error("Choose an account profile.");
  if(!input.text.trim()||input.text.length>1600)throw new Error("Paste 1–20 sample symbol lines (up to 1,600 characters).");
  const source=input.text.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  if(source.length>20)throw new Error("A batch supports up to 20 symbol lines.");
  if(sanitized(input.text)!==input.text)throw new Error("Remove credentials, URLs and contact details before mapping.");
  const rows:MappingCandidate[]=source.map(text=>{
    const parts=text.split(/\s*(?:=|→|->|:)\s*/);
    const match=findInstrument(parts[parts.length-1])??marketSymbols.find(s=>mappedBrokerSymbol(s,account)?.toLowerCase()===text.toLowerCase());
    const routing=match?mappedBrokerSymbol(match,account):undefined;
    const custom=parts.length===2&&/^[A-Za-z0-9./_#-]{1,32}$/.test(parts[0])&&routing&&parts[0].toUpperCase()!==match?.canonical?parts[0]:undefined;
    return {id:uid("map"),text,canonical:routing?match!.canonical:"",brokerSymbol:custom??routing??"",confidence:!routing||custom?"Needs confirmation":text.toUpperCase()===match?.canonical?"High":"Medium",reason:!routing?"No supported match on this profile. Pick a canonical instrument once.":custom?"Provider alias supplied. Verify the broker symbol before saving.":"Matched a canonical instrument and local broker catalog."};
  });
  log({tool:"symbol.map",args:`${account.label} · ${rows.length} input line(s)`,outcome:"Local mapping candidates prepared",approval:"Read only",approved:false,refs:[]});
  return latency(rows);
}
export async function acceptCopilotMappings(input:{accountId:string;rows:MappingCandidate[];confirmed:boolean}){
  const a=tradingAccounts.find(o=>o.id===input.accountId);
  if(!a||!input.rows.length||input.rows.length>20||!input.confirmed||input.rows.some(r=>!r.canonical||!r.brokerSymbol))throw new Error("Choose a canonical symbol and broker code for each row, then confirm the batch.");
  if(new Set(input.rows.map(r=>r.canonical)).size!==input.rows.length)throw new Error("Keep just one mapping per canonical symbol in a batch.");
  const values=await saveAccountSymbolOverrides(input.rows.map(r=>({accountId:a.id,canonical:r.canonical,brokerSymbol:r.brokerSymbol,source:"AI accepted"})));
  log({tool:"symbol.map",args:`${a.label} · ${values.map(r=>r.canonical).join(", ")}`,outcome:`${values.length} local mappings accepted`,approval:"Inline",approved:true,refs:values.map(v=>({ref:v.canonical,kind:"mapping",label:v.brokerSymbol}))});
  return latency({count:values.length,message:`Saved ${values.length} account-specific mapping${values.length===1?"":"s"} to the shared symbol map.`});
}

export async function getCopilotAnomalies(){
  const [accounts,rules]=await Promise.all([getAccounts(),getSignalRules()]);
  return latency(anomalyFixtures.map(f=>{
    const a=accounts.find(x=>x.id===f.accountId), rule=rules.find(x=>x.id===f.autoRule&&x.accountId===f.accountId);
    const observed=f.kind==="Margin"&&a?a.marginUsedPct:f.series[f.series.length-1];
    return {...f,accountLabel:a?.label??"Workspace",observed,status:reviewed.get(f.id)?.status??"Open",resolution:reviewed.get(f.id)?.message,canPause:!!rule?.enabled&&a?.broker==="paper"};
  }));
}
export type AnomalyRow=Awaited<ReturnType<typeof getCopilotAnomalies>>[number];
export async function reviewCopilotAnomaly(input:{id:string;action:"acknowledge"|"propose"}){
  const f=anomalyFixtures.find(x=>x.id===input.id); if(!f)throw new Error("Sample anomaly unavailable.");
  const [accounts,rules]=await Promise.all([getAccounts(),getSignalRules()]);const a=accounts.find(x=>x.id===f.accountId);if(!a)throw new Error("Account unavailable.");
  if(input.action==="acknowledge"){
    reviewed.set(f.id,{status:"Reviewed",message:"Acknowledged locally. No rules or positions changed."});
    log({tool:"anomaly.acknowledge",args:`${f.kind} · ${a.label}`,outcome:"Marked reviewed only",approval:"Inline",approved:true,refs:[]});
    return latency({message:"Marked reviewed locally.",draft:undefined as CopilotDraft|undefined});
  }
  const rule=rules.find(x=>x.id===f.autoRule&&x.accountId===a.id&&x.enabled);
  const draft=drafts.find(d=>d.status==="Pending"&&d.sourceKey===f.id)??createDraft(a,{source:"Anomaly",sourceKey:f.id,title:rule?`Review pause: ${rule.name}`:f.action,summary:f.description,classes:["guard.set"],args:`${a.label} · ${f.kind}`,payload:rule?{type:"pause",ruleId:rule.id,ruleLabel:rule.name}:{type:"preview",summary:"Inspect the current workspace before any risk action. This review cannot flip the global kill switch or flatten trades."}});
  return latency({message:"Review proposal prepared. Nothing changed.",draft});
}
let scanRunning=false;
export async function scanCopilotAnomalies(){
  if(scanRunning)throw new Error("A local scan is already running.");
  scanRunning=true;
  try{
    const rows=await getCopilotAnomalies();let count=0;
    if(autoMitigate&&policy.find(p=>p.action==="guard.set")?.mode==="Standing"){
      for(const f of rows.filter(x=>x.status==="Open"&&x.observed>x.threshold&&x.canPause&&x.autoRule)){
        const rule=await setSignalRuleEnabled(f.autoRule!,false);count++;
        reviewed.set(f.id,{status:"Mitigated",message:`Paused ${rule.name} locally. No positions closed.`});
        log({tool:"guard.set",args:`Pause ${rule.name} · single Paper rule`,outcome:"Paper rule paused by opt-in scan",approval:"Auto",approved:true,refs:[{ref:rule.id,kind:"rule",label:rule.name}]});
      }
    }
    log({tool:"anomaly.scan",args:"Local rule thresholds and evidence snapshots",outcome:`${rows.length} cases checked · ${count} mitigated`,approval:"Read only",approved:false,refs:[]});
    return latency({message:`Checked ${rows.length} rule-based cases. ${count?`${count} Paper rule paused locally.`:"Nothing was executed."} No broker polling or live ticks.`});
  }finally{scanRunning=false;}
}
export async function setBriefingSettings(input:BriefingSettings){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)||!["Concise","Analyst"].includes(input.tone)||!input.channels.length||input.channels.some(c=>!["In-app","Email preview","Telegram preview"].includes(c)))throw new Error("Choose a valid EAT time, tone and at least one sample channel.");
  briefingSettings=structuredClone({...input,channels:[...new Set(input.channels)]});
  log({tool:"briefing.settings",args:`${input.time} EAT · ${input.tone} · ${input.channels.join(", ")}`,outcome:"Preference saved locally. Nothing scheduled or sent.",approval:"Inline",approved:true,refs:[]});return latency(briefingSettings);
}
export async function getDailyBriefing(){
  const [accounts,trades,positions,events,schedules,rules,anomalies]=await Promise.all([getAccounts(),getTradeRecords(),getPositions(),getEconomicEvents(),getSchedulerSchedules(),getSignalRules(),getCopilotAnomalies()]);
  const nowMs=Date.now(), today=eatDay(nowMs), yesterday=eatDay(nowMs-86400000);
  const overnight=trades.filter(r=>[today,yesterday].includes(eatDay(r.closedAt))&&Date.parse(r.closedAt)<=nowMs);
  const perAccount=accounts.map(a=>({id:a.id,label:a.label,overnight:overnight.filter(r=>r.accountId===a.id).reduce((sum,r)=>sum+netPnl(r),0),open:positions.filter(p=>p.accountId===a.id).length,margin:a.marginUsedPct,floating:a.floatingPnl}));
  const risk=accounts.filter(a=>a.marginUsedPct>=60).length,strong=anomalies.filter(a=>a.status==="Open"&&a.severity==="Critical").length;
  const held=new Set(positions.map(p=>p.symbol));const affected=events.filter(e=>e.timeEat.includes("Today")&&e.affectedSymbols.some(s=>held.has(s)));
  const daySchedules=schedules.filter(s=>s.status==="armed"&&s.nextFire.startsWith("Today"));
  const active=rules.filter(r=>r.enabled);
  const text=`${positions.length} open positions across the workspace. ${risk} account${risk===1?"":"s"} in the 60%+ margin review band; ${strong} critical sample cases are still open.${briefingSettings.tone==="Analyst"?` ${affected.length} scheduled events overlap held symbols, and ${daySchedules.length} armed slots have a “Today” label. Compare risk before approving any new action.`:" Review exposure and event overlap before adding risk."}`;
  return latency({createdAt:now(),today,yesterday,text,accounts:perAccount,events:affected,schedules:daySchedules.map(s=>({ref:s.ref,name:s.name,time:s.nextFire})),rules:active.map(r=>({id:r.id,name:r.name,account:r.accountLabel})),critical:strong,settings:briefingSettings});
}
export async function regenerateDailyBriefing(){
  const briefing=await getDailyBriefing();log({tool:"briefing.generate",args:"Static workspace sources",outcome:"Local daily briefing regenerated",approval:"Read only",approved:false,refs:[]});return briefing;
}
export async function exportCopilotActivity(ids:string[]){
  const selected=ids.flatMap(id=>activity.find(a=>a.id===id)??[]);if(!selected.length)throw new Error("No audit rows match this view.");
  const csv=(s:string)=>`"${(/^[=+@\-\r\t]/.test(s)?`'${s}`:s).replace(/"/g,'""')}"`;
  const rows=[["When (UTC)","Tool","Redacted arguments","Outcome","Approval","Approved","Refs","Thread","Source"],...selected.map(x=>[x.at,x.tool,x.args,x.outcome,x.approval,x.approved?"Yes":"No",x.refs.map(r=>r.ref).join("; "),x.threadId??"",x.source])];
  return latency({filename:"ostrade-ai-activity.csv",text:rows.map(r=>r.map(csv).join(",")).join("\r\n")});
}
