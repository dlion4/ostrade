import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Bitcoin, Check, CircleAlert, CircleCheck, Clock3, Fingerprint, FlaskConical, History, KeyRound, Landmark, Layers3, LockKeyhole, Plus, Shield, ShieldCheck, Wallet } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { BrokerMark } from "@/components/accounts/AccountUI";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import { cryptoWithdrawalNetworks, getWithdrawalAccounts, getWithdrawalHistory, getWithdrawalSummary, type WithdrawalAccount, type WithdrawalRecord } from "@/services/withdrawals";
import { WithdrawalBuilder, type BuilderStart } from "@/components/withdrawals/WithdrawalBuilder";
import { WithdrawalDetails, WithdrawalHistory } from "@/components/withdrawals/WithdrawalHistory";
import { AuditPanel, CryptoPanel, DerivPanel, SafetyPanel } from "@/components/withdrawals/WithdrawalPanels";
import { amountLabel, Badge, Busy, Empty, railIcons, whole } from "@/components/withdrawals/WithdrawalUI";
import css from "@/styles/pages/dash-withdrawals.css?inline";
const sections = [["overview","Overview",Layers3], ["methods","Withdrawal methods",Wallet], ["builder","Safety ladder",KeyRound], ["deriv","Deriv flows",Landmark], ["crypto","Crypto",Bitcoin], ["history","History",History], ["policy","Safety controls",ShieldCheck], ["audit","Audit & ledger",Fingerprint]] as const;
type SectionKey = typeof sections[number][0];
const noRows: WithdrawalRecord[] = [];
function Section({ id, copy, children, action }: { id: SectionKey; copy: string; children: ReactNode; action?: ReactNode }) {
  const [,title,Icon] = sections.find(([key]) => key === id)!;
  return <section id={`wd-${id}`} aria-labelledby={`wd-title-${id}`} className="os-wd-section"><div className="os-wd-section-head"><div className="os-wd-section-label"><span className="os-wd-section-icon"><Icon size={17} /></span><div><h2 id={`wd-title-${id}`}>{id === "crypto" ? "Crypto withdrawals" : id === "history" ? "Withdrawal history" : title}</h2><p>{copy}</p></div></div>{action}</div>{children}</section>;
}
function Metrics() {
  const q = useQuery({ queryKey: ["withdrawal-summary"], queryFn: getWithdrawalSummary });
  if (q.isPending) return <div className="os-wd-metrics" role="status" aria-label="Loading withdrawal metrics">{[0,1,2,3,4].map(i => <div className="os-wd-card os-wd-metric os-wd-skeleton" key={i}><i /><i /><i /></div>)}</div>;
  if (q.isError) return <div className="os-wd-card"><Empty><button className="btn os-wd-btn" onClick={() => void q.refetch()}>Retry withdrawal metrics</button></Empty></div>;
  const {month,pending,processing,today,failed} = q.data;
  const cards = [[Wallet,"Withdrawn this month",month,"USD · sample + Paper","orange"],[Clock3,"Pending",pending,"Review or cooling hold","orange"],[Layers3,"Processing",processing,"At broker · snapshot only","blue"],[CircleCheck,"Settled today",today,"Sample + Paper · EAT","green"],[CircleAlert,"Failed · 7 days",failed,"Rejected or reversed · sample","red"]] as const;
  return <div className="os-wd-metrics">{cards.map(([Icon,label,value,note,tone],i) => <article key={label} className="os-wd-card os-wd-metric"><span className={`os-wd-icon os-wd-tone-${tone}`}><Icon size={16} /></span><span>{label}</span><strong><CountUp value={i===0?Math.round(value*100):value} duration={490} format={i===0?n=>amountLabel(n/100):undefined} /></strong><small>{note}</small></article>)}</div>;
}
function MethodMatrix({ accounts, active, open }: { accounts: WithdrawalAccount[]; active: string; open: (start: BuilderStart) => void }) {
  const [choice,setChoice] = useState("");
  const a = accounts.find(p => p.id === (choice || active)) ?? accounts.find(p => p.broker === "deriv") ?? accounts[0];
  if (!a) return <Empty>No account profiles available.</Empty>;
  return <><div className="os-wd-card os-wd-account-bar"><div className="os-wd-account-id"><BrokerMark broker={a.broker} /><div><strong>{a.label}</strong><small>{a.broker === "paper" ? `${amountLabel(a.balance)} simulated balance` : "Static profile · no balance verification"}</small></div></div><div className="os-wd-actions"><Badge tone={a.broker === "paper" ? "green" : "neutral"}>{amountLabel(a.available,a.currency)} withdrawable snapshot</Badge><select className="form-select form-select-sm" aria-label="Withdrawal profile" value={a.id} onChange={e => setChoice(e.target.value)}>{accounts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div></div>
    <div className="os-wd-rail-grid">{a.rails.map(r => { const Icon = railIcons[r.id]; const tone = !r.eligible ? "neutral" : r.id === "paper" ? "green" : r.id === "crypto" ? "violet" : r.id === "mpesa" || r.id === "cashier" ? "orange" : "blue"; return <article className="os-wd-card os-wd-rail" key={r.id}><header><span className={`os-wd-icon os-wd-tone-${tone}`}><Icon size={19} /></span><Badge tone={tone}>{r.eligible ? r.mode : "Unavailable · use manual"}</Badge></header><div><h3>{r.name}</h3><p>{r.reason ?? r.note}</p></div><div className="os-wd-rail-meta"><div><small>Limits ({r.currency})</small><strong>{whole(r.min,r.currency)}–{r.max.toLocaleString("en-US")}</strong></div><div><small>Example fee</small><strong>{r.id === "crypto" ? `${Math.min(...cryptoWithdrawalNetworks.map(n=>n.fee))}–${Math.max(...cryptoWithdrawalNetworks.map(n=>n.fee))} USDT` : r.id === "mpesa" ? "Varies by agent" : r.fee ? amountLabel(r.fee,r.currency) : "None shown"}</strong></div><div><small>Example ETA</small><strong>{r.eta}</strong></div></div><button className="os-wd-rail-open" aria-label={r.eligible ? `Use ${r.name}` : `Use manual proof for ${r.name}`} onClick={() => open({accountId:a.id,rail:r.eligible ? r.id : "manual"})}>{r.eligible ? "Use this method" : "Open manual fallback"} <ArrowUpRight size={15} /></button></article>; })}</div>
    <div className="os-wd-foot-line"><span>Limits and timing are illustrative; available amounts account for the margin guard.</span><Link to="/dashboard/accounts" className="os-wd-link">Manage account profiles <ArrowUpRight size={14} /></Link></div></>;
}
export function DashWithdrawalsPage() {
  usePageStyle("dash-withdrawals",css);
  const { activeAccountId, killSwitch } = useDashboardContext();
  const accountQuery = useQuery({ queryKey: ["withdrawal-accounts"], queryFn: getWithdrawalAccounts, refetchOnMount:"always" });
  const history = useQuery({ queryKey: ["withdrawal-history"], queryFn:getWithdrawalHistory });
  const accounts = accountQuery.data ?? [], rows = history.data ?? noRows;
  const paper = accounts.find(a=>a.broker === "paper"), binance = accounts.find(a=>a.broker === "binance");
  const active = accounts.find(a=>a.id === activeAccountId) ?? accounts.find(a=>a.broker === "deriv") ?? paper;
  const [builder,setBuilder] = useState<BuilderStart>(), [record,setRecord] = useState<WithdrawalRecord>(), [section,setSection] = useState<SectionKey>("overview");
  const open = (start:BuilderStart = {}) => setBuilder({accountId:active?.id,...start});
  const view = useCallback((row:WithdrawalRecord) => { setRecord(row); setBuilder(undefined); },[]);
  useEffect(() => { const old = document.title; document.title = "Withdrawals | OStrade"; return () => { document.title = old; }; },[]);
  useEffect(() => {
    let frame = 0;
    const scroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const current = sections.filter(([key]) => (document.getElementById(`wd-${key}`)?.getBoundingClientRect().top ?? Infinity) <= 144); setSection(window.innerHeight+window.scrollY >= document.documentElement.scrollHeight-14 ? "audit" : current[current.length-1]?.[0] ?? "overview"); }); };
    window.addEventListener("scroll",scroll,{passive:true}); return () => {window.removeEventListener("scroll",scroll); cancelAnimationFrame(frame);};
  },[]);
  const go = (key:SectionKey) => { setSection(key); document.getElementById(`wd-${key}`)?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"}); };
  return <main className="page-dash-withdrawals" aria-labelledby="withdrawals-title">
    <header className="os-wd-hero"><div className="os-wd-art" aria-hidden="true"><div className="os-wd-art-orbit"/><div className="os-wd-art-orbit"/><div className="os-wd-art-orbit"/><div className="os-wd-art-receipt"><span className="os-wd-art-receipt-head"><ShieldCheck size={18} /> Withdrawal controls</span><span><i><Check size={10}/></i> Destination selected</span><span><i><KeyRound size={10}/></i> Security review</span><span><i><Clock3 size={10}/></i> Cooling policy</span></div><span className="os-wd-art-float"><LockKeyhole size={14}/> Offline by design</span></div><div className="os-wd-hero-copy"><div className="os-wd-kicker"><span><ArrowUpRight size={15} /></span> FINANCE WORKSPACE</div><h1 id="withdrawals-title">Withdrawals<span>.</span></h1><p>Review what you can withdraw, choose a masked destination, and check each request before it reaches the ledger.</p><div className="os-wd-hero-meta"><Badge tone="orange"><Shield size={12}/> SAFETY LADDER</Badge><span><LockKeyhole size={13}/> External funding offline</span><span><Clock3 size={13}/> EAT (UTC+3)</span></div><div className="os-wd-actions"><button className="btn os-wd-btn os-wd-primary" onClick={() => open()} disabled={!active}><Plus size={16}/> New withdrawal</button><button className="btn os-wd-btn" onClick={() => go("history")}><History size={15}/> View history</button></div></div></header>
    <nav className="os-wd-nav" aria-label="Withdrawal sections">{sections.map(([key,label,Icon]) => <button key={key} aria-current={section === key ? "location" : undefined} onClick={() => go(key)}><Icon size={15}/> {label}</button>)}</nav>
    <Section id="overview" copy="Static funding snapshots and local Paper activity." action={<Badge>USD display · fixed rates</Badge>}><Metrics/></Section>
    <Section id="methods" copy="Review method availability, sample fees and broker-specific fallbacks." action={<Badge tone="orange"><LockKeyhole size={12}/> External previews only</Badge>}>{accountQuery.isPending ? <div className="os-wd-card"><Empty><Busy>Loading withdrawal profiles…</Busy></Empty></div> : accountQuery.isError ? <div className="os-wd-card"><Empty><button className="btn os-wd-btn" onClick={() => void accountQuery.refetch()}>Retry profiles</button></Empty></div> : <MethodMatrix accounts={accounts} active={activeAccountId} open={open}/>}</Section>
    <Section id="builder" copy="Complete separate local checks before recording your request."><div className="os-wd-card os-wd-process"><div><span className="os-wd-kicker">WITHDRAWAL WORKFLOW</span><h3>Review the net amount. Confirm the destination.</h3><p>Check withdrawable equity and fees before the two example security checks. Only an unheld Paper request can debit the simulator.</p><div className="os-wd-actions"><button className="btn os-wd-btn os-wd-primary" onClick={() => open()} disabled={!active}>Open withdrawal builder <ArrowRight size={15}/></button><button className="btn os-wd-btn" disabled={!paper} onClick={() => open({ accountId:paper?.id,rail:"paper" })}><FlaskConical size={15}/> Try Paper withdrawal</button></div></div><ol>{["Check account, amount and margin","Pick a masked destination","Check example TOTP and delivery OTP","Review fees, cooling and execution"].map((s,i) => <li key={s}><span>0{i+1}</span>{s}</li>)}</ol></div></Section>
    <Section id="deriv" copy="Preview API, Kenya agent and hosted cashier eligibility without opening any broker session."><DerivPanel accounts={accounts} rows={rows} open={open}/></Section>
    <Section id="crypto" copy="Compare fixed fee examples and manage approved sample destinations."><CryptoPanel account={binance} open={open}/></Section>
    <Section id="history" copy="Inspect masked destinations, status timelines, references and local receipt previews." action={<Badge>{rows.length} records</Badge>}>{history.isPending ? <div className="os-wd-card"><Empty><Busy>Loading withdrawal history…</Busy></Empty></div> : history.isError ? <div className="os-wd-card"><Empty><button className="btn os-wd-btn" onClick={() => void history.refetch()}>Retry history</button></Empty></div> : <WithdrawalHistory key={activeAccountId} rows={rows} accounts={accounts} view={view} scope={activeAccountId === "all" ? "" : activeAccountId}/>}</Section>
    <Section id="policy" copy="Edit local spend limits, cooling periods and destination enforcement."><SafetyPanel halt={killSwitch !== "armed"}/></Section>
    <Section id="audit" copy="Follow safety changes, staged requests and balanced Paper postings."><AuditPanel rows={rows} view={view}/></Section>
    <footer className="os-wd-footer"><span><FlaskConical size={14}/> Local session · Paper withdrawals, holds and safety changes reset on reload</span><button className="os-wd-link" onClick={() => document.getElementById("dash-main")?.scrollIntoView()}>Back to top <ArrowUpRight size={14}/></button></footer>
    {builder && accounts.length > 0 && <WithdrawalBuilder accounts={accounts} start={builder} close={() => setBuilder(undefined)} view={view}/>}{record && <WithdrawalDetails row={record} close={() => setRecord(undefined)}/>}
  </main>;
}
