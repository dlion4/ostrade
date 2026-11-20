import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, CircleCheck, FileText, Fingerprint, FlaskConical, Layers3, LockKeyhole, Plus, Scale, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getLedgerOverview, getTransferAccounts, getTransferHistory, transferRails, type TransferRail, type TransferRecord } from "@/services/transfers";
import { TransferBuilder, TransferDetails, type BuilderStart } from "@/components/transfers/TransferBuilder";
import { LedgerTable, TransferHistory } from "@/components/transfers/LedgerTables";
import { AuditPanel, RailsPanel, ReconciliationPanel, StatementPanel } from "@/components/transfers/FinancePanels";
import { amountLabel, Badge, Busy, Empty, transferIcons } from "@/components/transfers/TransferUI";
import css from "@/styles/pages/dash-transfers.css?inline";

const sections=[["overview","Overview",Layers3],["builder","Transfer routes",ArrowLeftRight],["history","History",BookOpen],["ledger","Ledger",Scale],["rails","Funding rails",SlidersHorizontal],["statements","Statements",FileText],["recon","Reconciliation",ShieldCheck],["audit","Audit",Fingerprint]] as const;
type Key=typeof sections[number][0];
const noRows:TransferRecord[]=[];
function Section({id,copy,action,children}:{id:Key;copy:string;action?:ReactNode;children:ReactNode}) {
  const [,name,Icon]=sections.find(([k])=>k===id)!;
  const title=id==="ledger"?"Double-entry ledger":id==="history"?"Transfer history":id==="audit"?"Audit & integrity":id==="rails"?"Funding rails manager":name;
  return <section id={`tl-${id}`} className="os-tl-section" aria-labelledby={`tl-title-${id}`}><div className="os-tl-section-head"><div className="os-tl-section-label"><span className="os-tl-section-icon"><Icon size={17}/></span><div><h2 id={`tl-title-${id}`}>{title}</h2><p>{copy}</p></div></div>{action}</div>{children}</section>;
}
function Metrics({recon}:{recon:()=>void}) {
  const q=useQuery({queryKey:["transfer-summary"],queryFn:getLedgerOverview});
  if(q.isPending)return <div className="os-tl-metrics" role="status" aria-label="Loading ledger overview">{[0,1,2,3,4].map(i=><div key={i} className="os-tl-card os-tl-metric os-tl-skeleton"><i/><i/><i/></div>)}</div>;
  if(q.isError)return <div className="os-tl-card"><Empty><button className="btn os-tl-btn" onClick={()=>void q.refetch()}>Retry overview</button></Empty></div>;
  const d=q.data;
  const cards=[[Wallet,"Net deposits",d.net,"All-time deposits − withdrawals","orange",true],[Scale,"Aggregate drift",d.drift,`Book ${amountLabel(d.internal)} · Reported ${amountLabel(d.reported)}`,"blue",true],[ArrowLeftRight,"Transfers this month",d.transfers,"Posted · sample + Paper","violet",false],[BookOpen,"Ledger entries today",d.entries,"All posted movements · EAT","green",false]] as const;
  return <div className="os-tl-metrics">{cards.map(([Icon,name,n,detail,tone,cash])=><article className="os-tl-card os-tl-metric" key={name}><span className={`os-tl-icon os-tl-tone-${tone}`}><Icon size={16}/></span><span>{name}</span><strong><CountUp value={cash?Math.round(n*100):n} duration={480} format={cash?v=>amountLabel(v/100):undefined}/></strong><small>{detail}</small></article>)}<article className="os-tl-card os-tl-metric"><span className="os-tl-icon os-tl-tone-orange"><CircleCheck size={16}/></span><span>Reconciliation</span><strong>{d.synced} / {d.synced+d.flagged}</strong><button className="os-tl-link" onClick={recon}>{d.flagged} drift or stale <ArrowRight size={12}/></button></article></div>;
}
export function DashTransfersPage() {
  usePageStyle("dash-transfers",css);
  const {activeAccountId}=useDashboardContext();
  const accountsQuery=useQuery({queryKey:["transfer-accounts"],queryFn:getTransferAccounts,refetchOnMount:"always"});
  const history=useQuery({queryKey:["transfer-history"],queryFn:getTransferHistory});
  const accounts=accountsQuery.data??[],rows=history.data??noRows;
  const [builder,setBuilder]=useState<BuilderStart>(),[detail,setDetail]=useState<TransferRecord>(),[nav,setNav]=useState<Key>("overview");
  const active=accounts.find(a=>a.id===activeAccountId),paper=accounts.filter(a=>a.broker==="paper"),deriv=accounts.filter(a=>a.broker==="deriv"),mt5=accounts.filter(a=>a.broker==="exness"),binance=accounts.find(a=>a.broker==="binance");
  const scope=active?.id??(activeAccountId!=="all"?activeAccountId:"");
  const open=(start:BuilderStart={})=>setBuilder({fromId:active?.id??paper[0]?.id,...start});
  const view=useCallback((r:TransferRecord)=>{setDetail(r);setBuilder(undefined);},[]);
  const routes:[TransferRail,string,string[],BuilderStart,boolean][]=[
    ["paper","Local simulation",["No fee","Paired posting","Instant"],{rail:"paper",fromId:paper[0]?.id,toId:paper[1]?.id},paper.length>=2],
    ["deriv","Adapter preview",["Sample FX","Instant model","Deriv only"],{rail:"deriv",fromId:deriv[0]?.id,toId:deriv[1]?.id},deriv.length>=2],
    ["binance","Wallet preview",["Spot","Funding","Futures"],{rail:"binance",fromId:binance?.id,toId:binance?.id},!!binance],
    ["mt5","Manual · two legs",["Withdraw","Confirm proof","Deposit"],{rail:"mt5",fromId:mt5[0]?.id,toId:mt5[1]?.id},mt5.length>=2],
  ];
  useEffect(()=>{const old=document.title;document.title="Transfers & Ledger | OStrade";return()=>{document.title=old;};},[]);
  useEffect(()=>{let id=0;const read=()=>{cancelAnimationFrame(id);id=requestAnimationFrame(()=>{const current=sections.filter(([k])=>(document.getElementById(`tl-${k}`)?.getBoundingClientRect().top??Infinity)<=144);setNav(window.scrollY+innerHeight>=document.documentElement.scrollHeight-14?"audit":current[current.length-1]?.[0]??"overview");});};window.addEventListener("scroll",read,{passive:true});return()=>{window.removeEventListener("scroll",read);cancelAnimationFrame(id);};},[]);
  const go=(key:Key)=>{setNav(key);document.getElementById(`tl-${key}`)?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});};
  return <main className="page-dash-transfers" aria-labelledby="transfers-title">
    <header className="os-tl-hero"><div className="os-tl-art" aria-hidden="true"><div className="os-tl-art-track"/><div className="os-tl-art-ticket os-tl-art-debit"><span><Wallet size={16}/> SOURCE BOOK</span><strong>Debit</strong><small>Movement recorded</small></div><span className="os-tl-art-icon"><ArrowLeftRight size={23}/></span><div className="os-tl-art-ticket os-tl-art-credit"><span><CircleCheck size={16}/> DESTINATION BOOK</span><strong>Credit</strong><small>Matched posting</small></div><span className="os-tl-art-marker"><Scale size={14}/> Balanced by design</span></div><div className="os-tl-hero-copy"><div className="os-tl-kicker"><span><Scale size={15}/></span> FINANCE WORKSPACE</div><h1 id="transfers-title">Transfers &amp; Ledger<span>.</span></h1><p>Move funds between your own accounts, then trace every posting from its source through to reconciliation.</p><div className="os-tl-hero-meta"><Badge tone="green"><FlaskConical size={13}/> PAPER SIMULATION</Badge><span><LockKeyhole size={13}/> Broker actions offline</span><span><BookOpen size={13}/> USD display · EAT</span></div><div className="os-tl-actions"><button className="btn os-tl-btn os-tl-primary" onClick={()=>open()} disabled={!accounts.length}><Plus size={16}/> New transfer</button><button className="btn os-tl-btn" onClick={()=>go("ledger")}><BookOpen size={15}/> View ledger</button></div></div></header>
    <nav className="os-tl-nav" aria-label="Transfers and ledger sections">{sections.map(([k,name,Icon])=><button type="button" key={k} aria-current={nav===k?"location":undefined} onClick={()=>go(k)}><Icon size={15}/> {name}</button>)}</nav>
    <Section id="overview" copy="A single view of posted cash movements and balance differences." action={<Badge>Fixed sample rates</Badge>}><Metrics recon={()=>go("recon")}/></Section>
    <Section id="builder" copy="Pick a route, compare fees and legs, then confirm with an example authenticator code." action={<Badge tone="orange"><LockKeyhole size={12}/> External previews only</Badge>}>
      {accountsQuery.isError?<div className="os-tl-card"><Empty><button className="btn os-tl-btn" onClick={()=>void accountsQuery.refetch()}>Retry account profiles</button></Empty></div>:accountsQuery.isPending?<div className="os-tl-card"><Empty><Busy>Loading account profiles…</Busy></Empty></div>:<div className="os-tl-rail-grid">{routes.map(([rail,tag,features,start,available])=>{const Icon=transferIcons[rail];const tone=rail==="paper"?"green":rail==="binance"?"violet":rail==="mt5"?"orange":"blue";return <article className="os-tl-card os-tl-rail" key={rail}><header><span className={`os-tl-icon os-tl-tone-${tone}`}><Icon size={19}/></span><Badge tone={tone}>{tag}</Badge></header><div><h3>{transferRails[rail].title}</h3><p>{transferRails[rail].detail}</p></div><div className="os-tl-rail-meta">{features.map(v=><strong key={v}>{v}</strong>)}</div><button className="os-tl-rail-open" aria-label={`Preview ${transferRails[rail].title}`} disabled={!available} onClick={()=>open(start)}>Build this route <ArrowUpRight size={15}/></button></article>;})}</div>}
      <div className="os-tl-foot-line"><span>Cross-broker routes use a two-leg withdrawal and deposit checklist, with no live orders.</span><button className="os-tl-link" disabled={!deriv[0]||!mt5[0]} onClick={()=>open({rail:"manual",fromId:deriv[0]?.id,toId:mt5[0]?.id})}>Try cross-broker preview <ArrowRight size={14}/></button></div>
    </Section>
    <Section id="history" copy="Open the combined receipt, inspect each leg, or export the filtered view." action={<Badge>{rows.length} records</Badge>}>{history.isPending?<div className="os-tl-card"><Empty><Busy>Loading transfer history…</Busy></Empty></div>:history.isError?<div className="os-tl-card"><Empty><button className="btn os-tl-btn" onClick={()=>void history.refetch()}>Retry transfer history</button></Empty></div>:<TransferHistory key={scope} rows={rows} accounts={accounts} scope={scope} view={view}/>}</Section>
    <Section id="ledger" copy="See both sides of funding, transfers, trading costs and adjustments in the shared book."><LedgerTable key={scope} accounts={accounts} scope={scope}/></Section>
    <Section id="rails" copy="Configure local rail availability, fees, limits and masked sample destinations."><RailsPanel accounts={accounts}/></Section>
    <Section id="statements" copy="Generate monthly PDF or XLSX previews from the actual local postings."><StatementPanel key={scope} accounts={accounts} scope={scope}/></Section>
    <Section id="recon" copy="Review drift and stale balances. Adjustments require a reason and are never silent."><ReconciliationPanel/></Section>
    <Section id="audit" copy="Inspect local finance events, export a signed audit file, or check its integrity."><AuditPanel/></Section>
    <footer className="os-tl-footer"><span><FlaskConical size={14}/> Local session · no broker polling, money movement or live FX</span><button className="os-tl-link" onClick={()=>document.getElementById("dash-main")?.scrollIntoView()}>Back to top <ArrowUpRight size={14}/></button></footer>
    {builder&&accounts.length>0&&<TransferBuilder accounts={accounts} start={builder} close={()=>setBuilder(undefined)} view={view}/>}{detail&&<TransferDetails row={detail} close={()=>setDetail(undefined)}/>}
  </main>;
}
