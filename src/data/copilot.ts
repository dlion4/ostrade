import type { BrokerKey } from "./dashboard";
import type { ScheduleTrigger } from "./scheduler";

export type ActionClass = "order.place" | "position.close" | "position.modify" | "schedule.create" | "rule.create" | "guard.set" | "finance.*";
export type ApprovalMode = "Always ask" | "Standing" | "Never";
export type ApprovalPolicy = { action: ActionClass; mode: ApprovalMode; inline2FA: boolean; detail: string };
export const initialApproval: ApprovalPolicy[] = [
  {action:"order.place",mode:"Always ask",inline2FA:true,detail:"Exact symbol, size, entry and protective levels."},
  {action:"position.close",mode:"Always ask",inline2FA:true,detail:"Only the positions shown in the reviewed scope."},
  {action:"position.modify",mode:"Always ask",inline2FA:true,detail:"Stop and target changes, including breakeven."},
  {action:"schedule.create",mode:"Always ask",inline2FA:false,detail:"Local paused drafts. No job is started."},
  {action:"rule.create",mode:"Always ask",inline2FA:false,detail:"Local disabled rules. Installation never activates."},
  {action:"guard.set",mode:"Always ask",inline2FA:true,detail:"Pause a selected Paper rule or record a guard draft."},
  {action:"finance.*",mode:"Always ask",inline2FA:true,detail:"Locked. Co-Pilot never moves funds."},
];
export type ToolActivity = { name:string; args:string; result:string; kind:"Read"|"Review"|"Local" };
export type CopilotMessage = { id:string;role:"operator"|"assistant";text:string;at:string;tools?:ToolActivity[];proposalId?:string };
export type CopilotThread = {id:string;title:string;createdAt:string;messages:CopilotMessage[]};
export type ActionReceipt = { ref:string; kind:"order"|"position"|"schedule"|"rule"|"guard"|"preview"|"mapping"; label:string };
export type DraftObject = { kind:"schedule"|"rule"|"guard"; name:string; symbol:string; detail:string; trigger?:ScheduleTrigger; direction?:"BUY"|"SELL"; size?:string; maxOpen?:number; strategy?:"entry"|"close"|"breakeven"|"digits"; threshold?:number };
export type ActionPayload =
  | {type:"order"; symbol:string; side:"BUY"|"SELL"; size:number; entry:number; sl:number; tp:number; unit:"lots"|"shares"|"stake"}
  | {type:"close"; ids:string[]; refs:string[]; symbol:string; lossOnly?:number}
  | {type:"modify"; id:string; ref:string; sl:number; tp:number}
  | {type:"install"; objects:DraftObject[]; templateId?:string}
  | {type:"pause"; ruleId:string; ruleLabel:string}
  | {type:"preview"; summary:string};
export type CopilotDraft = {id:string;threadId?:string;createdAt:string;title:string;summary:string;accountId:string;accountLabel:string;broker:BrokerKey;classes:ActionClass[];args:string;source:"Chat"|"Template"|"Briefing"|"Anomaly"|"Sample";confidence?:string;payload:ActionPayload;status:"Pending"|"Running"|"Simulated"|"Drafts saved"|"Offline preview"|"Rejected"|"Blocked";receipt:ActionReceipt[];outcome?:string;sourceKey?:string};
export type CopilotAudit = {id:string;at:string;threadId?:string;tool:string;args:string;outcome:string;approval:"Read only"|"Inline"|"Standing"|"Auto"|"Rejected"|"Blocked";approved:boolean;refs:ActionReceipt[];override?:boolean;source:"Fixture"|"Session"};
export type Template={id:string;name:string;category:"Schedules"|"Rules"|"Guards";description:string;risk:string;target:"paper"|"deriv";objects:DraftObject[]};
const schedule=(name:string,symbol:string,detail:string,size:string,trigger:ScheduleTrigger="session",strategy:DraftObject["strategy"]="entry",direction:DraftObject["direction"]="BUY"):DraftObject=>({kind:"schedule",name,symbol,detail,size,trigger,strategy,direction});
const rule=(name:string,symbol:string,detail:string,strategy:DraftObject["strategy"]="entry"):DraftObject=>({kind:"rule",name,symbol,detail,strategy});
const guard=(name:string,detail:string,value:number):DraftObject=>({kind:"guard",name,symbol:"WORKSPACE",detail,threshold:value});
export const copilotTemplates:Template[]=[
  {id:"london",name:"London Breakout Ladder",category:"Schedules",description:"Three staggered EURUSD entry reviews around the London open.",risk:"Open gaps and spread spikes can invalidate the setup.",target:"paper",objects:[0,15,30].map(m=>schedule(`London breakout · +${m}m`,"EURUSD",`London open +${m} min · breakout review`,"0.05 lots"))},
  {id:"telegram",name:"Telegram Signal Auto-Exec",category:"Rules",description:"Start with a trusted Telegram rule and a daily-loss guard draft.",risk:"Only mapped signals with stops; never auto-activate imported rules.",target:"paper",objects:[rule("Telegram allow-list","XAUUSD","Synthetic Signals KE · SL required · max 3 open"),guard("Telegram daily loss guard","Pause the strategy above 3% daily loss (draft)",3)]},
  {id:"digits",name:"Deriv Digits Bot Preset",category:"Schedules",description:"Two R_100 review schedules, one Even and one Odd.",risk:"Digit contracts can lose the entire stake; no Deriv execution here.",target:"deriv",objects:[schedule("R_100 Even","R_100","Every 30m · DIGITEVEN","2 USD stake","interval","digits"),schedule("R_100 Odd","R_100","Every 30m · DIGITODD","2 USD stake","interval","digits")]},
  {id:"sweep",name:"Session Close Sweep",category:"Schedules",description:"Review a flat-book sweep at 23:55 EAT.",risk:"A close-all action requires a separate review of open positions.",target:"paper",objects:[schedule("End-of-day close sweep","PORTFOLIO","23:55 EAT · review all open Paper positions","Close intent only","cron","close")]},
  {id:"breakeven",name:"Breakeven Mover",category:"Rules",description:"Draft a rule to move the stop to entry after +1R.",risk:"Preview-only intent. Stop changes need their own approval.",target:"paper",objects:[rule("Breakeven at +1R","XAUUSD","At +1R → propose SL at entry (no automatic stop changes)","breakeven")]},
  {id:"asia",name:"Asia Range Review",category:"Schedules",description:"Stage a USDJPY review at the Asia open.",risk:"Thin liquidity can widen spreads.",target:"paper",objects:[schedule("Asia range open","USDJPY","At Asia open","0.05 lots","session","entry","SELL")]},
  {id:"news",name:"High-Impact News Buffer",category:"Guards",description:"An advisory buffer for high-impact events.",risk:"A saved draft does not pause any running rule.",target:"paper",objects:[guard("News window review","Review risk within 15 minutes of high-impact news",15)]},
  {id:"futures",name:"US Index Opening Checklist",category:"Schedules",description:"Two US index review slots around the New York open.",risk:"Do not assume session opens at a fixed local hour year-round.",target:"paper",objects:[schedule("NY index open","US30","New York open","0.02 lots"),schedule("NY index retest","US30","New York open +30m","0.02 lots")]},
  {id:"crypto",name:"Weekend Crypto Limit",category:"Rules",description:"Restrict crypto signals to small sizing and require a stop.",risk:"Low liquidity and gap risk remain even at reduced size.",target:"paper",objects:[rule("Weekend crypto review","BTCUSDT","Stop required · 0.05 lots max · manual activation") ]},
  {id:"loss",name:"Daily Loss Watch",category:"Guards",description:"Record a 4% daily loss rule proposal.",risk:"Advisory only until a real risk engine is connected.",target:"paper",objects:[guard("Daily loss review","Propose pausing automation at 4% daily loss",4)]},
];
export const promptExamples=[
  {label:"London schedule batch",text:"Create 20 schedules that buy R_10 RISE with 5 USD every 15 minutes during the London session, max 3 open at once"},
  {label:"Review losing positions",text:"Close every EURUSD position losing more than $50 on Exness"},
  {label:"Rank signal sources",text:"Summarize my trading week and rank my signal sources"},
  {label:"Draft a loss guard",text:"Set a guard: pause all automation if daily loss exceeds 4%"},
  {label:"Preview a Paper trade",text:"Buy 0.10 lots EURUSD at 1.0850 SL 1.0800 TP 1.0950"},
  {label:"Read the ledger",text:"Summarize my ledger"},
];
export type Severity="Critical"|"Warning"|"Info";
export type AnomalyFixture={id:string;kind:"Drawdown"|"Sizing"|"Signal storm"|"Adapter stale"|"Margin"|"Schedule conflict";title:string;severity:Severity;accountId:string;description:string;series:number[];threshold:number;unit:string;hours:number;action:"Pause rule"|"Review kill switch"|"Review exposure"|"Review schedule";autoRule?:string};
export const anomalyFixtures:AnomalyFixture[]=[
  {id:"an-01",kind:"Drawdown",title:"Drawdown spike",severity:"Critical",accountId:"acc-paper-main",description:"Intraday sample drawdown exceeded its trailing review band.",series:[.4,.5,.7,.9,1.8,4.3],threshold:3,unit:"%",hours:1,action:"Review kill switch"},
  {id:"an-02",kind:"Sizing",title:"Stake outlier",severity:"Warning",accountId:"acc-paper-main",description:"Sample order size exceeded three times the rolling median; no order was sent.",series:[1.1,.9,1,1.2,1.3,4.5],threshold:3,unit:"× median",hours:2,action:"Review exposure"},
  {id:"an-03",kind:"Signal storm",title:"Telegram signal burst",severity:"Critical",accountId:"acc-paper-main",description:"The sample feed exceeded its 10-minute burst threshold.",series:[2,3,2,6,11,18],threshold:12,unit:"signals / 10m",hours:4,action:"Pause rule",autoRule:"rul-01"},
  {id:"an-04",kind:"Adapter stale",title:"Deriv quote snapshot is stale",severity:"Warning",accountId:"acc-deriv-demo",description:"Mock adapter reported gaps above the stale quote threshold.",series:[2,3,4,8,15,42],threshold:30,unit:"seconds",hours:5,action:"Review exposure"},
  {id:"an-05",kind:"Margin",title:"Exness margin pressure",severity:"Critical",accountId:"acc-exness-trial",description:"The static account profile sits above the 60% review band.",series:[43,47,49,55,56,62],threshold:60,unit:"%",hours:10,action:"Review exposure"},
  {id:"an-06",kind:"Schedule conflict",title:"Duplicate EURUSD slot",severity:"Warning",accountId:"acc-paper-main",description:"Two sample schedules share a symbol and minute. Inspect both refs before removing a slot.",series:[1,1,1,1,2,2],threshold:1,unit:"overlapping slots",hours:18,action:"Review schedule"},
  {id:"an-07",kind:"Drawdown",title:"Drawdown band recovered",severity:"Info",accountId:"acc-paper-reserve",description:"An earlier fixture crossed its band and subsequently recovered.",series:[1,2,3.2,2.1,1.4,1],threshold:3,unit:"%",hours:36,action:"Review exposure"},
  {id:"an-08",kind:"Sizing",title:"Index sizing review",severity:"Warning",accountId:"acc-exness-raw",description:"Sample index quantity is elevated relative to its account baseline.",series:[1,1,1.1,1.3,2.1,3.2],threshold:3,unit:"× median",hours:51,action:"Review exposure"},
  {id:"an-09",kind:"Adapter stale",title:"Binance quote delay",severity:"Info",accountId:"acc-binance-testnet",description:"Historical example of a delayed quote snapshot, not live adapter health.",series:[1,2,20,65,35,2],threshold:30,unit:"seconds",hours:84,action:"Review exposure"},
  {id:"an-10",kind:"Schedule conflict",title:"Overlapping close review",severity:"Warning",accountId:"acc-paper-main",description:"Two end-of-session draft objects overlap in this example.",series:[1,1,0,1,1,2],threshold:1,unit:"overlapping slots",hours:152,action:"Review schedule"},
];
const anchor=Date.now();
export const seedAudit:CopilotAudit[]=Array.from({length:12},(_,i)=>({id:`ai-audit-sample-${i}`,at:new Date(anchor-(i+1)*37*3600000).toISOString(),tool:i%3===0?"ledger.query":i%3===1?"schedule.create":"position.close",args:i%3===0?"Account snapshot · USD":i%3===1?"Paper schedule preview":"Paper position review",outcome:i%3===0?"Read snapshot":i%3===1?"Draft reviewed":"Sample dismissed",approval:i%3===0?"Read only":i%3===1?"Inline":"Rejected",approved:i%3===1,refs:[],override:i===8,source:"Fixture"}));
export const seedThreads:CopilotThread[]=[{id:"sample-thread",title:"Example session · read only",createdAt:new Date(anchor-86400000).toISOString(),messages:promptExamples.slice(0,5).flatMap((p,i)=>[{id:`sample-q-${i}`,role:"operator",text:p.text,at:new Date(anchor-86400000+i*120000).toISOString()},{id:`sample-a-${i}`,role:"assistant",text:"Historical walkthrough only. Tool payloads and approvals are not executable from this sample thread.",at:new Date(anchor-86400000+i*120000+4000).toISOString(),tools:[{name:["schedule.create","position.close","records.query","guard.set","order.preview"][i],args:"Redacted sample scope",result:"Example trace",kind:"Review"}]}])}];
export type BriefingSettings={time:string;tone:"Concise"|"Analyst";channels:("In-app"|"Email preview"|"Telegram preview")[]};
export const briefingDefaults:BriefingSettings={time:"07:30",tone:"Concise",channels:["In-app"]};
