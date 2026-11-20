import { useCallback,useEffect,useState,type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bot, CheckCircle2, ClipboardCheck, Fingerprint, GitBranch, Layers3, LockKeyhole, Radar, ShieldCheck, Sparkles, Sun, Terminal, Workflow } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getCopilotAccounts,getCopilotDrafts,getCopilotOverview } from "@/services/copilot";
import { Console,ProposalDialog,ProposalQueue } from "@/components/copilot/CopilotConsole";
import { Anomalies,Briefing,Gallery,Mapper } from "@/components/copilot/CopilotWorkspaces";
import { Activity,Policy } from "@/components/copilot/CopilotGovernance";
import { Badge,Busy,Empty,Note } from "@/components/copilot/CopilotUI";
import css from "@/styles/pages/dash-copilot.css?inline";
const sections=[["overview","Overview",Layers3],["console","Chat console",Bot],["proposals","Proposals",ClipboardCheck],["gallery","Templates",Workflow],["mapping","Symbol mapper",GitBranch],["briefing","Daily briefing",Sun],["anomalies","Anomalies",Radar],["policy","Approvals",ShieldCheck],["audit","Activity",Fingerprint]] as const;
type Key=typeof sections[number][0];
function Section({id,copy,action,children}:{id:Key;copy:string;action?:ReactNode;children:ReactNode}){
 const [,label,Icon]=sections.find(s=>s[0]===id)!;
 return <section className="os-ai-section" id={`cp-${id}`} aria-labelledby={`cp-title-${id}`}><div className="os-ai-section-head"><div className="os-ai-section-label"><span className="os-ai-section-icon"><Icon size={17}/></span><div><h2 id={`cp-title-${id}`}>{({proposals:"Proposal queue",gallery:"Automation gallery",anomalies:"Anomaly review",policy:"Approval policy",audit:"Activity & audit"} as Record<string,string>)[id]??label}</h2><p>{copy}</p></div></div>{action}</div>{children}</section>;
}
function Metrics(){
 const q=useQuery({queryKey:["copilot-overview"],queryFn:getCopilotOverview});
 if(q.isPending)return <div className="os-ai-metrics" role="status" aria-label="Loading workspace metrics">{[0,1,2,3].map(n=><div className="os-ai-card os-ai-metric os-ai-skeleton" key={n}><i/><i/><i/></div>)}</div>;
 if(q.isError)return <div className="os-ai-card"><Empty><button className="btn os-ai-btn" onClick={()=>void q.refetch()}>Retry metrics</button></Empty></div>;
 const m=q.data, cards=[[Terminal,"AI actions logged",m.actions,"All time · sample and local","violet"],[CheckCircle2,"Accepted / rejected",m.accepted,"Sample and local proposals","green"],[Radar,"Anomalies caught · 7d",m.anomalies,"Rule-based sample evidence","orange"],[ShieldCheck,"Manual overrides",m.overrides,"Audited operator decisions","blue"]] as const;
 return <div className="os-ai-metrics">{cards.map(([Icon,label,value,caption,tone],i)=><article className="os-ai-card os-ai-metric" key={label}><span className={`os-ai-icon os-ai-tone-${tone}`}><Icon size={16}/></span><span>{label}</span><strong><CountUp value={value} duration={480}/>{i===1&&<small> / {m.rejected}</small>}</strong><small>{caption}</small></article>)}</div>;
}
export function DashCopilotPage(){
 usePageStyle("dash-copilot",css);
 const {activeAccountId}=useDashboardContext();
 const account=useQuery({queryKey:["copilot-accounts"],queryFn:getCopilotAccounts});
 const proposals=useQuery({queryKey:["copilot-drafts"],queryFn:getCopilotDrafts});
 const [current,setCurrent]=useState<Key>("overview"),[chosen,setChosen]=useState<string>(),[preset,setPreset]=useState<{text:string;id:number}>();
 const open=useCallback((id:string)=>setChosen(id),[]);
 const selected=proposals.data?.find(d=>d.id===chosen);
 useEffect(()=>{const old=document.title;document.title="AI Co-Pilot | OStrade";return()=>{document.title=old;};},[]);
 useEffect(()=>{let frame=0;const read=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const matches=sections.filter(([k])=>(document.getElementById(`cp-${k}`)?.getBoundingClientRect().top??Infinity)<=144);setCurrent(window.scrollY+innerHeight>=document.documentElement.scrollHeight-14?"audit":matches[matches.length-1]?.[0]??"overview");});};window.addEventListener("scroll",read,{passive:true});return()=>{window.removeEventListener("scroll",read);cancelAnimationFrame(frame);};},[]);
 const go=(key:Key)=>{setCurrent(key);document.getElementById(`cp-${key}`)?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});};
 const prompt=(text:string)=>{setPreset({text,id:Date.now()});go("console");};
 return <main className="page-dash-copilot" aria-labelledby="copilot-title"><header className="os-ai-hero"><div aria-hidden="true" className="os-ai-art"><div className="os-ai-orbit"/><div className="os-ai-orbit"/><div className="os-ai-orbit"/><div className="os-ai-core"><Sparkles size={40}/></div><div className="os-ai-art-chip os-ai-art-read"><Terminal size={16}/><span><strong>Tool trace</strong><small>Read-only snapshot</small></span></div><div className="os-ai-art-chip os-ai-art-approve"><ShieldCheck size={17}/><span><strong>Human approval</strong><small>No live dispatch</small></span></div></div><div className="os-ai-hero-copy"><div className="os-ai-kicker"><span><Sparkles size={15}/></span> DECISION WORKSPACE</div><h1 id="copilot-title">AI Co-Pilot<span>.</span></h1><p>Turn a question into a reviewable plan. See which tools were used and decide what happens next.</p><div className="os-ai-hero-meta"><Badge tone="violet"><Bot size={13}/> LOCAL DEMO</Badge><span><LockKeyhole size={13}/> Approval required</span><span><Terminal size={13}/> Fixed workspace snapshots</span></div><div className="os-ai-actions"><button className="btn os-ai-btn os-ai-primary" onClick={()=>go("console")}><Sparkles size={15}/> Open console</button><button className="btn os-ai-btn" onClick={()=>go("proposals")}><ClipboardCheck size={15}/> Review proposals</button></div></div></header>
 <nav className="os-ai-nav" aria-label="Co-Pilot sections">{sections.map(([k,label,Icon])=><button key={k} aria-current={current===k?"location":undefined} onClick={()=>go(k)}><Icon size={15}/> {label}</button>)}</nav>
 <Section id="overview" copy="A snapshot of decisions, interventions and anomaly evidence." action={<Badge tone="violet">No model or broker connection</Badge>}><Metrics/></Section>
 <Section id="console" copy="Ask questions and inspect the tool trace. Trade plans stay pending until reviewed."><Console accounts={account.data??[]} active={activeAccountId} review={open} preset={preset}/>{account.isError&&<Note danger>Account profiles could not load. <button className="os-ai-link" onClick={()=>void account.refetch()}>Retry</button></Note>}</Section>
 <Section id="proposals" copy="A separate, human-controlled inbox for every proposed write." action={<Badge tone="orange">{proposals.data?.filter(d=>d.status==="Pending").length??0} pending</Badge>}>{proposals.isError?<div className="os-ai-card"><Empty><button className="btn os-ai-btn" onClick={()=>void proposals.refetch()}>Retry proposals</button></Empty></div>:<ProposalQueue rows={proposals.data??[]} review={open} pending={proposals.isPending}/>}</Section>
 <Section id="gallery" copy="Inspect a recipe’s exact schedules, rules and guards before installing paused drafts."><Gallery accounts={account.data??[]} review={open}/></Section>
 <Section id="mapping" copy="Resolve plain-language symbols, review uncertainty and confirm the shared routing map."><Mapper/></Section>
 <Section id="briefing" copy="Start with journal results, open risk, event overlap and today’s automation."><Briefing prompt={prompt} goAnomalies={()=>go("anomalies")}/></Section>
 <Section id="anomalies" copy="Review rule-based evidence and scoped mitigations. No background monitoring runs."><Anomalies review={open}/></Section>
 <Section id="policy" copy="Choose when to ask, allow a scoped Paper action, or block an action class."><Policy/></Section>
 <Section id="audit" copy="Trace decisions and tool inputs, or export the filtered redacted log."><Activity/></Section>
 <footer className="os-ai-footer"><span><Sparkles size={14}/> Session-only assistant · accepted mappings persist locally</span><button className="os-ai-link" onClick={()=>document.getElementById("dash-main")?.scrollIntoView()}>Back to top <ArrowUpRight size={14}/></button></footer>
 {selected&&<ProposalDialog key={selected.id} draft={selected} close={()=>setChosen(undefined)}/>}{chosen&&!selected&&<div className="os-ai-floating" role="status"><Busy>Opening proposal…</Busy><button className="btn os-ai-btn" onClick={()=>setChosen(undefined)}>Cancel</button></div>}
 </main>;
}
