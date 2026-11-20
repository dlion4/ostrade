import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bitcoin, Check, ChevronDown, CircleAlert, CircleCheck, Clock3, FileCheck2, FlaskConical, History, Landmark, Layers3, LockKeyhole, Plus, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { usePageStyle } from "@/hooks/usePageStyle";
import { useDashboardContext } from "@/context/DashboardContext";
import { BrokerMark, names } from "@/components/accounts/AccountUI";
import { getDepositHistory, getDepositSummary, getFundingAccounts, type CryptoNetwork, type DepositRecord, type FundingAccount } from "@/services/deposits";
import { DepositBuilder, type BuilderStart } from "@/components/deposits/DepositBuilder";
import { DepositDetails, DepositHistory } from "@/components/deposits/DepositHistory";
import { CashierPanel, DepositLedger, RecoveryPanel } from "@/components/deposits/DepositPanels";
import { CryptoPreview } from "@/components/deposits/CryptoPreview";
import { amountLabel, Badge, Busy, Empty, railIcons, timingLabel, whole } from "@/components/deposits/DepositUI";
import css from "@/styles/pages/dash-deposits.css?inline";

const sections = [["overview","Overview",Layers3], ["methods","Funding methods",Wallet], ["review","Deposit builder",FileCheck2], ["cashier","Deriv cashier",Landmark], ["crypto","Crypto",Bitcoin], ["history","History",History], ["recovery","Recovery",ShieldCheck], ["ledger","Ledger",ReceiptText]] as const;
type SectionKey = typeof sections[number][0];
const emptyRows: DepositRecord[] = [];
function Section({ id, copy, action, children }: { id: SectionKey; copy: string; action?: ReactNode; children: ReactNode }) {
  const [, title, Icon] = sections.find(([key]) => key === id)!;
  return <section className="os-dep-section" id={`dep-${id}`} aria-labelledby={`dep-title-${id}`}><div className="os-dep-section-head"><div className="os-dep-section-label"><span className="os-dep-section-icon"><Icon size={17} /></span><div><h2 id={`dep-title-${id}`}>{id === "history" ? "Deposit history" : id === "crypto" ? "Crypto instructions" : id === "recovery" ? "Deposit recovery" : id === "ledger" ? "Ledger activity" : title}</h2><p>{copy}</p></div></div>{action}</div>{children}</section>;
}
function HeroArt() {
  return <div className="os-dep-art" aria-hidden="true"><svg viewBox="0 0 530 230" preserveAspectRatio="xMidYMid slice" fill="none"><defs><pattern id="dep-art-grid" width="23" height="23" patternUnits="userSpaceOnUse"><path d="M0 23V0H23" stroke="currentColor" strokeOpacity=".18" /></pattern></defs><rect width="530" height="230" fill="url(#dep-art-grid)" /><path d="M118 177H202Q218 177 218 163V129M282 125H377Q393 125 393 109V54H498M294 129V169Q294 185 311 185H442" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" /><circle cx="135" cy="177" r="4" fill="currentColor" /><circle cx="477" cy="54" r="5" fill="currentColor" /><circle cx="424" cy="185" r="4" fill="currentColor" /></svg>
  <div className="os-dep-art-receipt"><span className="os-dep-art-receipt-head"><Wallet size={18} /> Funding route</span><span><i><Check size={10} /></i> Method selected</span><span><i><Check size={10} /></i> Review details</span><span><i><ShieldCheck size={10} /></i> Ledger tracked</span></div>
  <span className="os-dep-art-float"><LockKeyhole size={15} /> Local preview</span></div>;
}

function Metrics() {
  const q = useQuery({ queryKey: ["deposit-summary"], queryFn: getDepositSummary });
  const [timing, setTiming] = useState("cashier");
  const current = q.data?.timing.find((t) => t.rail === timing);
  const metrics = [
    { icon: Wallet, label: "Deposited this month", value: q.data?.month ?? 0, style: "orange", line: "Sample + simulated · USD", cash: true },
    { icon: Clock3, label: "Pending", value: q.data?.pending ?? 0, style: "orange", line: "Sample deposits in review", cash: false },
    { icon: CircleCheck, label: "Confirmed today", value: q.data?.today ?? 0, style: "green", line: "EAT · sample + simulated", cash: false },
    { icon: CircleAlert, label: "Failed · 7 days", value: q.data?.failed ?? 0, style: "red", line: "Sample recovery cases", cash: false },
  ];
  if (q.isError) return <div className="os-dep-card"><Empty><button className="btn os-dep-btn" onClick={() => void q.refetch()}>Retry funding metrics</button></Empty></div>;
  if (q.isPending) return <div className="os-dep-metrics" role="status" aria-label="Loading funding metrics">{[0,1,2,3,4].map((n) => <div className="os-dep-card os-dep-metric os-dep-skeleton" key={n}><i/><i/><i/></div>)}</div>;
  return <div className="os-dep-metrics">{metrics.map(({ icon: Icon, label, value, style, line, cash }) => <article className="os-dep-card os-dep-metric" key={label}><span className={`os-dep-icon os-dep-tone-${style}`}><Icon size={16} /></span><span>{label}</span><strong><CountUp value={cash ? Math.round(value * 100) : value} duration={490} format={cash ? (n) => amountLabel(n / 100) : undefined} /></strong><small>{line}</small></article>)}<article className="os-dep-card os-dep-metric os-dep-timing"><span className="os-dep-icon os-dep-tone-blue"><History size={16} /></span><span>Avg. confirmation</span><strong>{current ? timingLabel(current.minutes) : "—"}</strong><label><select className="form-select form-select-sm" aria-label="Average confirmation rail" value={timing} onChange={(e) => setTiming(e.target.value)}>{q.data?.timing.map((t) => <option key={t.rail} value={t.rail}>{t.label}</option>)}</select></label></article></div>;
}

function FundingMethods({ accounts, active, open }: { accounts: FundingAccount[]; active: string; open: (start: BuilderStart) => void }) {
  const [selected, setSelected] = useState("");
  const account = accounts.find((a) => a.id === (selected || active)) ?? accounts.find((a) => a.broker === "deriv") ?? accounts[0];
  return <>
    <div className="os-dep-card os-dep-account-bar"><div className="os-dep-account-id">{account && <BrokerMark broker={account.broker} />}<div><strong>{account?.label ?? "No account profiles"}</strong><small>{account ? names[account.broker] : "Choose a workspace in Accounts"} · {account?.broker === "paper" ? `${amountLabel(account.balance)} simulated balance` : "Static profile"}</small></div></div><div className="os-dep-actions">{account && <Badge tone={account.broker === "paper" ? "green" : "neutral"}>{account.broker === "paper" ? "Simulated" : account.depositCapability?.v === "partial" ? `Conditional API · ${account.depositCapability.note ?? "review"}` : account.depositCapability?.v === "yes" ? "Adapter supports API · offline" : "Manual rail · no deposit API"}</Badge>}<select className="form-select form-select-sm" aria-label="Funding profile" value={account?.id ?? ""} onChange={(e) => setSelected(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div></div>
    {account ? <div className="os-dep-rail-grid">{account.rails.map((r) => { const Icon = railIcons[r.id], tone = r.id === "crypto" ? "violet" : r.id === "mpesa-agent" || r.id === "paper" ? "green" : r.id === "cashier" ? "orange" : "blue"; return <article className="os-dep-card os-dep-rail" key={r.id}><header><span className={`os-dep-icon os-dep-tone-${tone}`}><Icon size={20} /></span><Badge tone={tone}>{r.mode}</Badge></header><div><h3>{r.title}</h3><small>{r.category}</small><p>{r.note}</p></div><div className="os-dep-rail-meta"><div><small>Amount limits</small><strong>{whole(r.min,r.currency)}–{r.max.toLocaleString("en-US")}</strong></div><div><small>Fee {r.id === "mpesa-agent" ? "from" : "estimate"}</small><strong>{r.fee ? whole(r.fee,r.currency) : "None shown"}</strong></div><div><small>Example ETA</small><strong>{r.eta}</strong></div></div><button className="os-dep-rail-open" aria-label={`Use ${r.title}`} onClick={() => open({ accountId: account.id, rail: r.id })}>Use this method <ArrowUpRight size={16} /></button></article>; })}</div> : <Empty>No funding profiles available.</Empty>}
    <div className="os-dep-foot-line"><span>Limits, fees and timing are illustrative and subject to broker eligibility.</span><Link to="/dashboard/accounts" className="os-dep-link">Manage account profiles <ArrowUpRight size={14} /></Link></div>
  </>;
}
export function DashDepositsPage() {
  usePageStyle("dash-deposits", css);
  const { activeAccountId } = useDashboardContext();
  const funding = useQuery({ queryKey: ["funding-accounts"], queryFn: getFundingAccounts, refetchOnMount: "always" });
  const history = useQuery({ queryKey: ["deposit-history"], queryFn: getDepositHistory });
  const [section, setSection] = useState<SectionKey>("overview");
  const [builder, setBuilder] = useState<BuilderStart>();
  const [details, setDetails] = useState<DepositRecord>();
  const [network, setNetwork] = useState<CryptoNetwork>("TRC20");
  const [cryptoAmount, setCryptoAmount] = useState("100");
  const [currencyHelp, setCurrencyHelp] = useState(false);
  const accounts = funding.data ?? [];
  const paper = accounts.find((a) => a.broker === "paper");
  const defaultAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts.find((a) => a.broker === "deriv") ?? paper;
  const rows = history.data ?? emptyRows;
  const open = (start: BuilderStart = {}) => setBuilder({ accountId: defaultAccount?.id, ...start });
  const view = useCallback((row: DepositRecord) => { setDetails(row); setBuilder(undefined); }, []);
  useEffect(() => { const old = document.title; document.title = "Deposits | OStrade"; return () => { document.title = old; }; }, []);
  useEffect(() => {
    let frame = 0;
    const read = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const current = sections.filter(([id]) => (document.getElementById(`dep-${id}`)?.getBoundingClientRect().top ?? Infinity) <= 144);
      const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 14;
      setSection(bottom ? "ledger" : current[current.length - 1]?.[0] ?? "overview");
    }); };
    window.addEventListener("scroll", read, { passive: true });
    return () => { window.removeEventListener("scroll", read); cancelAnimationFrame(frame); };
  }, []);
  const go = (id: SectionKey) => { setSection(id); document.getElementById(`dep-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); };
  return <main className="page-dash-deposits" aria-labelledby="deposits-title">
    <header className="os-dep-hero"><HeroArt /><div className="os-dep-hero-copy"><div className="os-dep-kicker"><span><ArrowDownToLine size={14} /></span> FINANCE WORKSPACE</div><h1 id="deposits-title">Deposits<span>.</span></h1><p>Choose a funding method, review the details, and trace every deposit from the first request to the ledger.</p><div className="os-dep-hero-meta"><Badge tone="green"><FlaskConical size={13} /> LOCAL SIMULATION</Badge><span><LockKeyhole size={13} /> External funding offline</span><span><Clock3 size={13} /> EAT (UTC+3)</span></div><div className="os-dep-actions"><button className="btn os-dep-btn os-dep-primary" disabled={!defaultAccount} onClick={() => open()}><Plus size={16} /> New deposit</button><button className="btn os-dep-btn" onClick={() => go("history")}><History size={15} /> View history</button></div></div></header>
    <nav className="os-dep-nav" aria-label="Deposit sections">{sections.map(([id,label,Icon]) => <button type="button" key={id} aria-current={section === id ? "location" : undefined} onClick={() => go(id)}><Icon size={15} /> {label}</button>)}</nav>
    <Section id="overview" copy="A static view of funding activity across your workspace." action={<button className="os-dep-currency" onClick={() => setCurrencyHelp(!currencyHelp)} aria-expanded={currencyHelp}>USD display <ChevronDown size={14} /></button>}>
      {currencyHelp && <div className="os-dep-inset os-dep-currency-note">USD is the reporting currency. KES values use an illustrative rate of 129.50 KES per USD, and USDT is shown at a sample 1:1 rate. No live FX feed is connected.</div>}<Metrics />
    </Section>
    <Section id="methods" copy="Available methods depend on the account profile and adapter capabilities." action={<Badge tone="orange"><LockKeyhole size={12} /> Preview only, except Paper</Badge>}>
      {funding.isPending ? <div className="os-dep-card"><Empty><Busy>Loading funding profiles…</Busy></Empty></div> : funding.isError ? <div className="os-dep-card"><Empty><button className="btn os-dep-btn" onClick={() => void funding.refetch()}>Retry funding profiles</button></Empty></div> : <FundingMethods accounts={accounts} active={activeAccountId} open={open} />}
    </Section>
    <Section id="review" copy="Validate a draft before recording the request.">
      <div className="os-dep-card os-dep-process"><div><span className="os-dep-kicker">DEPOSIT WORKFLOW</span><h3>Review first. Post only when confirmed.</h3><p>All methods use the same record and request key. Paper credits the simulator immediately; external methods stop at a staged preview.</p><div className="os-dep-actions"><button className="btn os-dep-btn os-dep-primary" disabled={!defaultAccount} onClick={() => open()}>Open deposit builder <ArrowRight size={15} /></button><button className="btn os-dep-btn" disabled={!paper} onClick={() => open({ accountId: paper?.id, rail: "paper" })}><FlaskConical size={15} /> Try Paper top-up</button></div></div><ol>{["Select account and method","Set amount and validate details","Review fee, ETA and request key","Stage preview or simulate credit"].map((label,i) => <li key={label}><span>0{i+1}</span>{label}</li>)}</ol></div>
    </Section>
    <Section id="cashier" copy="Preview Deriv's hosted credit matching and Kenya M-Pesa agents."><CashierPanel accounts={accounts} open={open} /></Section>
    <Section id="crypto" copy="Compare network examples, verification, and confirmation requirements."><div className="os-dep-card os-dep-panel"><div className="os-dep-panel-heading"><div><h3>Demo address book</h3><p>Reusable versus per-request models. No payable address is ever generated.</p></div><label className="os-dep-field os-dep-crypto-amount"><span>Example amount (USDT)</span><input type="number" className="form-control form-control-sm" min="0.01" step="0.01" value={cryptoAmount} onChange={(e) => setCryptoAmount(e.target.value)} /></label></div><CryptoPreview network={network} setNetwork={setNetwork} amount={Number(cryptoAmount)} /></div></Section>
    <Section id="history" copy="Search and export sample deposits, local previews, and simulated credits." action={<Badge>{rows.length} records</Badge>}>
      {history.isPending ? <div className="os-dep-card"><Empty><Busy>Reading deposit history…</Busy></Empty></div> : history.isError ? <div className="os-dep-card"><Empty><button className="btn os-dep-btn" onClick={() => void history.refetch()}>Retry deposit history</button></Empty></div> : <DepositHistory key={activeAccountId} rows={rows} accounts={accounts} open={view} scope={activeAccountId === "all" ? "" : activeAccountId} />}
    </Section>
    <Section id="recovery" copy="Review stuck or failed sample deposits and keep track of follow-ups."><RecoveryPanel open={open} /></Section>
    <Section id="ledger" copy="Follow confirmed credits to their source records and balanced postings."><DepositLedger view={view} rows={rows} /></Section>
    <footer className="os-dep-footer"><span><FlaskConical size={14} /> Local workspace · Drafts, attachments and simulated top-ups last for this session</span><button className="os-dep-link" onClick={() => document.getElementById("dash-main")?.scrollIntoView()}>Back to top <ArrowUpRight size={14} /></button></footer>
    {builder && accounts.length > 0 && <DepositBuilder accounts={accounts} start={builder} close={() => setBuilder(undefined)} view={view} />}
    {details && <DepositDetails row={details} close={() => setDetails(undefined)} />}
  </main>;
}
