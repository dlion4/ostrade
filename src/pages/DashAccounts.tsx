import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, ArrowUpRight, CircleCheck, FlaskConical, History, Layers3, LockKeyhole, Network, Plug, Plus, Route as RouteIcon, ShieldCheck, SlidersHorizontal, Wallet, Workflow } from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import { useDashboardContext, type GlobalWorkspaceMode } from "@/context/DashboardContext";
import { useToast } from "@/components/Toast";
import { CountUp } from "@/components/CountUp";
import { getAccounts } from "@/services/dashboard";
import { auditContextSelection, getBrokerProviders, type BrokerKey, type TradingAccount } from "@/services/accounts";
import { AccountDetail } from "@/components/accounts/AccountDetail";
import { ConnectWizard } from "@/components/accounts/ConnectWizard";
import { AdapterActionDialog, AdapterHealth, AuditTable, FinanceSync, MappingTable, type ActionInput, type DetailTab } from "@/components/accounts/HubTools";
import { accountTag, BrokerMark, Busy, CapabilityTags, Chip, Dialog, Empty, StateNote, dollars, names } from "@/components/accounts/AccountUI";
import css from "@/styles/pages/dash-accounts.css?inline";

const sections = [["overview", "Overview", Layers3], ["accounts", "Accounts", Wallet], ["context", "Routing", RouteIcon], ["connect", "Setup", Plug], ["health", "Health", Activity], ["symbols", "Symbol map", Workflow], ["finance", "Finance & sync", History], ["audit", "Audit log", ShieldCheck]] as const;
type SectionID = typeof sections[number][0];
const featured = ["acc-paper-main", "acc-deriv-demo", "acc-exness-trial"];
function HeroArtwork() {
  return <div className="os-hub-hero-art" aria-hidden="true">
    <svg viewBox="0 0 500 220" preserveAspectRatio="xMidYMid slice" fill="none"><path d="M20 105H120Q140 105 155 86L190 44Q201 33 223 33H311M115 105H325M100 105H125Q139 105 151 119L197 161Q211 175 233 175H314" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" /><path d="M308 33H405M317 105H438M305 175H428" stroke="currentColor" strokeWidth="1" opacity=".4" /><circle cx="119" cy="105" r="5" fill="currentColor" /><circle cx="296" cy="33" r="4" fill="currentColor" /><circle cx="330" cy="105" r="4" fill="currentColor" /><circle cx="302" cy="175" r="4" fill="currentColor" /></svg>
    <span className="os-hub-art-node os-hub-art-root"><BrokerMark broker="paper" /></span><span className="os-hub-art-node os-hub-art-one"><BrokerMark broker="deriv" compact /> Deriv OAuth</span><span className="os-hub-art-node os-hub-art-two"><BrokerMark broker="exness" compact /> MT5 Bridge</span><span className="os-hub-art-node os-hub-art-three"><BrokerMark broker="alpaca" compact /> API keys</span>
  </div>;
}
function Section({ id, description, action, children }: { id: SectionID; description: string; action?: ReactNode; children: ReactNode }) {
  const [, title, Icon] = sections.find(([item]) => item === id)!;
  return <section className="os-hub-section" id={`hub-${id}`} aria-labelledby={`hub-heading-${id}`}><div className="os-hub-section-head"><div className="os-hub-section-label"><span className="os-hub-section-icon"><Icon size={17} /></span><div><h2 id={`hub-heading-${id}`}>{id === "context" ? "Active routing context" : id === "connect" ? "Connection setup" : title}</h2><p>{description}</p></div></div>{action}</div>{children}</section>;
}
function AccountCard({ a, active, view }: { a: TradingAccount; active: boolean; view: () => void }) {
  return <article className={`os-hub-card os-hub-account ${active ? "os-hub-account-active" : ""}${a.environment === "live-ready" ? " os-hub-account-live" : ""}`}>
    <div className="os-hub-account-head"><BrokerMark broker={a.broker} /><div><strong>{names[a.broker]}</strong><small>{a.accountNumber} · {a.currency}</small></div><Chip tone={a.broker === "paper" ? "green" : a.environment === "live-ready" ? "orange" : "neutral"}>{accountTag(a)}</Chip></div>
    <div className="os-hub-account-title"><h3>{a.label}</h3><span className="os-hub-account-status"><i className={a.broker === "paper" ? "os-hub-dot-local" : ""} /> {a.broker === "paper" ? "Local engine" : a.connected ? "Offline snapshot" : "Standby"}</span></div>
    <div className="os-hub-account-figures"><div><small>Equity</small><strong>{dollars(a.equity, a.currency)}</strong></div><div><small>Balance</small><strong>{dollars(a.balance, a.currency)}</strong></div></div>
    <div className="os-hub-account-pnl"><span>Realized today</span><strong className={a.realizedToday > 0 ? "os-hub-up" : a.realizedToday < 0 ? "os-hub-down" : ""}>{dollars(a.realizedToday, a.currency, true)}</strong></div>
    <div className="os-hub-margin"><span>Margin used <strong>{a.marginUsedPct.toFixed(1)}%</strong></span><div className="progress" role="progressbar" aria-valuenow={a.marginUsedPct} aria-label={`${a.label} margin used`}><div className={`progress-bar${a.marginUsedPct > 60 ? " os-hub-margin-warning" : ""}`} style={{ width: `${a.marginUsedPct}%` }} /></div></div>
    <CapabilityTags broker={a.broker} />
    <button className="os-hub-account-open" type="button" aria-label={`View ${a.label} account`} onClick={view}>{active ? <><CircleCheck size={14} /> Active account</> : "Account details"}<ArrowUpRight size={15} /></button>
  </article>;
}

export function DashAccountsPage() {
  usePageStyle("dash-accounts", css);
  const q = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const providers = useQuery({ queryKey: ["hub-providers"], queryFn: getBrokerProviders });
  const qc = useQueryClient();
  const toast = useToast();
  const { activeAccountId, setActiveAccountId, globalMode, setGlobalMode, fanoutAccountIds, setFanoutAccountIds } = useDashboardContext();
  const [section, setSection] = useState<SectionID>("overview");
  const [accountsFilter, setAccountsFilter] = useState("featured");
  const [detail, setDetail] = useState<{ id: string; tab: DetailTab }>();
  const [wizard, setWizard] = useState<false | { broker?: BrokerKey }>(false);
  const [action, setAction] = useState<ActionInput>();
  const [routingMode, setRoutingMode] = useState<GlobalWorkspaceMode>();
  const [draft, setDraft] = useState<{ account: string; targets: string[] }>();
  const [routingNotice, setRoutingNotice] = useState("");
  const accountList = q.data ?? [];
  const connected = accountList.filter((a) => a.connected);
  const metrics = connected.filter((a) => a.currency === "USD");
  const localCount = connected.filter((a) => a.broker === "paper").length;
  const active = connected.find((a) => a.id === activeAccountId);
  const editingAccount = detail ? accountList.find((a) => a.id === detail.id) : undefined;
  const visible = accountsFilter === "featured" ? accountList.filter((a) => featured.includes(a.id)) : accountsFilter === "workspaces" ? connected : accountsFilter === "standby" ? accountList.filter((a) => !a.connected) : accountList;
  const audit = useMutation({ mutationFn: (input: { account?: TradingAccount; mode: GlobalWorkspaceMode; count: number }) => auditContextSelection(input.account, input.mode, input.count), onSuccess: () => void qc.invalidateQueries({ queryKey: ["account-audit"] }) });
  const settings = draft ?? { account: activeAccountId, targets: fanoutAccountIds };
  const eligible = connected.filter((a) => globalMode === "paper" ? a.environment === "paper" : a.environment !== "paper");
  const saveRouting = (id: string, ids: string[], mode: GlobalWorkspaceMode, message: string) => {
    setActiveAccountId(id); setGlobalMode(mode); setFanoutAccountIds(ids); setDraft(undefined); setRoutingNotice(message);
    audit.mutate({ account: accountList.find((a) => a.id === id), mode, count: ids.length || (id === "all" ? 0 : 1) });
    toast(message);
  };
  const activate = (a: TradingAccount) => {
    saveRouting(a.id, [a.id], a.environment === "paper" ? "paper" : "live", `${a.label} is the active ${a.environment === "paper" ? "simulation" : "preview"} account. No broker connection changed.`);
    setWizard(false); setDetail(undefined);
    if (a.broker === "paper" && !featured.includes(a.id)) setAccountsFilter("workspaces");
  };
  const go = (id: SectionID) => { setSection(id); document.getElementById(`hub-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); };
  const openDetail = (id: string, tab: DetailTab = "Overview") => setDetail({ id, tab });
  useEffect(() => { const previous = document.title; document.title = "Accounts & Broker Hub | OStrade"; return () => { document.title = previous; }; }, []);
  useEffect(() => {
    const update = () => {
      const nearEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
      const visible = sections.filter(([id]) => (document.getElementById(`hub-${id}`)?.getBoundingClientRect().top ?? Infinity) <= 144);
      if (visible.length) setSection(nearEnd ? "audit" : visible[visible.length - 1][0]);
      else setSection("overview");
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const stats = [
    { name: "Snapshot equity", value: metrics.reduce((total, a) => total + a.equity, 0), icon: Wallet, color: "orange", copy: "Configured workspaces · USD", currency: true },
    { name: "Total balance", value: metrics.reduce((total, a) => total + a.balance, 0), icon: Layers3, color: "blue", copy: "Excludes standby accounts", currency: true },
    { name: "Account workspaces", value: connected.length, icon: Network, color: "violet", copy: `${accountList.length - connected.length} standby profiles`, currency: false },
    { name: "Local simulation", value: localCount, icon: FlaskConical, color: "green", copy: "No external sessions are open", currency: false },
  ];
  return <main className="page-dash-accounts" aria-labelledby="hub-title">
    <header className="os-hub-hero"><HeroArtwork /><div className="os-hub-hero-content"><div className="os-hub-eyebrow"><span><Network size={14} /></span> TRADING WORKSPACE</div><h1 id="hub-title">Accounts <em>&amp;</em> Broker Hub</h1><p>Manage broker profiles, choose where tickets route, and review adapter capabilities from one workspace.</p><div className="os-hub-hero-meta"><Chip tone="green"><span className="os-hub-dot-local" /> LOCAL ENGINE</Chip><span><LockKeyhole size={13} /> External connections offline</span><span><Activity size={13} /> Static snapshots</span></div></div>
      <div className="os-hub-hero-actions"><button type="button" className="btn os-hub-btn" onClick={() => go("health")}><Activity size={16} /> Adapter health</button><button type="button" className="btn os-hub-btn os-hub-primary" disabled={!providers.data} onClick={() => setWizard({})}><Plus size={17} /> Connect account</button></div>
    </header>
    <nav className="os-hub-nav" aria-label="Account hub sections">{sections.map(([id, label, Icon]) => <button key={id} type="button" aria-current={section === id ? "location" : undefined} onClick={() => go(id)}><Icon size={15} /> {label}</button>)}</nav>
    <Section id="overview" description="A consolidated snapshot of your configured account workspaces." action={<Chip><LockKeyhole size={12} /> Frontend-only workspace</Chip>}>
      {q.isPending ? <div className="os-hub-stats" role="status" aria-label="Loading accounts">{[0,1,2,3].map((i) => <div className="os-hub-card os-hub-stat os-hub-skeleton" key={i}><i /><i /><i /></div>)}</div> : q.isError ? <div className="os-hub-card"><Empty><button className="btn os-hub-btn" onClick={() => void q.refetch()}>Retry accounts</button></Empty></div> : <div className="os-hub-stats">{stats.map(({ name, value, icon: Icon, copy, color, currency }) => <article className="os-hub-card os-hub-stat" key={name}><span className={`os-hub-tile-icon os-hub-color-${color}`}><Icon size={16} /></span><span>{name}</span><strong><CountUp value={currency ? Math.round(value * 100) : value} duration={490} format={currency ? (n) => dollars(n / 100) : undefined} /></strong><small>{copy}</small></article>)}</div>}
    </Section>
    <Section id="accounts" description="Review local Paper and broker snapshot profiles before choosing a route." action={<div className="os-hub-segments" role="group" aria-label="Account list filters">{[["featured", "Featured"], ["workspaces", "Workspaces"], ["standby", "Standby"], ["all", "All"]].map(([value, label]) => <button key={value} aria-pressed={accountsFilter === value} onClick={() => setAccountsFilter(value)}>{label}</button>)}</div>}>
      {q.isPending ? <Empty><Busy>Loading account workspaces…</Busy></Empty> : <><div className="os-hub-accounts">{visible.map((a) => <AccountCard key={a.id} a={a} active={a.id === activeAccountId} view={() => openDetail(a.id)} />)}{accountsFilter !== "featured" && <button type="button" className="os-hub-add-card" disabled={!providers.data} onClick={() => setWizard({})}><span><Plus size={22} /></span><strong>Add an account</strong><small>Start a Paper account or stage a broker configuration.</small></button>}</div>
      {accountsFilter === "featured" && <div className="os-hub-section-foot"><span>{visible.length} featured profiles · {accountList.length} available</span><button className="os-hub-link" onClick={() => setAccountsFilter("all")}>View all accounts <ArrowRight size={14} /></button></div>}</>}
    </Section>
    <Section id="context" description="Choose the default context and fan-out targets shared by Markets, Trade Ticket, and Signal Desk.">
      <div className="os-hub-card os-hub-context"><div className="os-hub-context-main"><div className="os-hub-panel-head"><div><h3>Default account routing</h3><p>Preferences are saved in this browser.</p></div><Chip tone={globalMode === "paper" ? "green" : "orange"}>{globalMode === "paper" ? "Paper mode" : "Live preview"}</Chip></div><label className="os-hub-field"><span>Default account</span><select className="form-select" value={settings.account} onChange={(e) => setDraft({ ...settings, account: e.target.value })}><option value="all">All account workspaces</option>{connected.map((a) => <option value={a.id} key={a.id}>{a.label}</option>)}</select></label>
      <fieldset className="os-hub-field"><legend>Ticket fan-out targets</legend><div className="os-hub-targets">{eligible.map((a) => <label key={a.id}><input className="form-check-input" type="checkbox" checked={settings.targets.includes(a.id)} onChange={(e) => setDraft({ ...settings, targets: e.target.checked ? [...settings.targets, a.id] : settings.targets.filter((id) => id !== a.id) })} /><BrokerMark broker={a.broker} compact />{a.label}</label>)}</div></fieldset>
      {routingNotice && <StateNote>{routingNotice}</StateNote>}<div className="os-hub-actions"><button className="btn os-hub-btn os-hub-primary" disabled={!draft || audit.isPending} onClick={() => saveRouting(settings.account, settings.targets.filter((id) => eligible.some((a) => a.id === id)), globalMode, "Routing preferences saved locally.")}>Save routing preferences</button><Link className="btn os-hub-btn" to="/dashboard/trade">Open trade ticket <ArrowUpRight size={14} /></Link></div></div>
      <div className="os-hub-mode-card"><span className="os-hub-tile-icon os-hub-color-orange"><SlidersHorizontal size={18} /></span><h3 id="hub-routing-mode" tabIndex={-1}>Workspace mode</h3><p>Paper runs local simulations. Live preview selects demo snapshots and keeps external execution locked.</p><div className="os-hub-segments" role="group" aria-label="Workspace mode">{(["paper", "live"] as const).map((mode) => <button key={mode} aria-pressed={globalMode === mode} onClick={() => { if (mode !== globalMode) setRoutingMode(mode); }}>{mode === "paper" ? "Paper" : "Live preview"}</button>)}</div><small><ShieldCheck size={14} /> {active ? `Active: ${active.label}` : "Active: All account workspaces"}</small></div></div>
    </Section>
    <Section id="connect" description="Choose a connection method, validate sample fields, and preview permissions before staging.">
      <div className="os-hub-card os-hub-panel"><div className="os-hub-panel-head"><div><h3>Broker directory</h3><p>Paper creates a real local workspace. OAuth, MT5 and API credentials remain offline.</p></div><button className="btn os-hub-btn" disabled={!providers.data} onClick={() => setWizard({})}><Plug size={15} /> Open wizard</button></div>
      {providers.isPending ? <Empty><Busy>Loading provider directory…</Busy></Empty> : providers.isError ? <Empty><button className="btn os-hub-btn" onClick={() => void providers.refetch()}>Retry providers</button></Empty> : <div className="os-hub-provider-grid os-hub-directory">{(providers.data ?? []).slice(0, 7).map((p) => <button key={p.id} className="os-hub-provider" type="button" onClick={() => setWizard({ broker: p.id })}><BrokerMark broker={p.id} compact /><span><strong>{p.name}</strong><small>{p.connect}</small></span><ArrowRight size={15} /></button>)}</div>}</div>
    </Section>
    <Section id="health" description="Inspect adapter snapshots and run local or offline diagnostic flows." action={<Chip tone="orange"><LockKeyhole size={13} /> No live probes</Chip>}><AdapterHealth start={setAction} /></Section>
    <Section id="symbols" description="Translate canonical instruments into the exact symbols each account expects."><MappingTable accounts={accountList} preferred="acc-exness-trial" /></Section>
    <Section id="finance" description="Review funding capabilities and historical coverage without contacting a broker."><FinanceSync accounts={accountList} showDetail={openDetail} /></Section>
    <Section id="audit" description="Trace setup, diagnostics, mapping changes and workspace routing decisions."><AuditTable accounts={accountList} /></Section>
    <footer className="os-hub-footer"><span><FlaskConical size={14} /> OStrade local workspace · External broker access is offline</span><button className="os-hub-link" onClick={() => document.getElementById("dash-main")?.scrollIntoView()}>Back to top <ArrowUpRight size={14} /></button></footer>
    {wizard && providers.data && <ConnectWizard providers={providers.data} initial={wizard.broker} onPaper={activate} close={() => setWizard(false)} />}
    {editingAccount && detail && <AccountDetail key={editingAccount.id} account={editingAccount} initial={detail.tab} close={() => setDetail(undefined)} action={setAction} activate={activate} />}
    {action && <AdapterActionDialog input={action} close={() => setAction(undefined)} />}
    {routingMode && <Dialog title={routingMode === "live" ? "Switch to live preview?" : "Switch to Paper mode?"} kicker="WORKSPACE ROUTING" close={() => setRoutingMode(undefined)}><div className="os-hub-flow"><StateNote>{routingMode === "live" ? "This switches ticket defaults to a demo snapshot. Trade review is still required, and no live order or broker connection can be made." : "This selects a Paper simulator for new tickets. Existing positions and open orders will not be changed."}</StateNote><div className="os-hub-dialog-actions"><button className="btn os-hub-btn" onClick={() => setRoutingMode(undefined)}>Cancel</button><button className="btn os-hub-btn os-hub-primary" onClick={() => { const target = connected.find((a) => routingMode === "paper" ? a.broker === "paper" : a.environment === "demo"); saveRouting(target?.id ?? "all", target ? [target.id] : [], routingMode, routingMode === "paper" ? "Paper routing is active." : "Live preview saved. External execution remains offline."); setRoutingMode(undefined); }}>Confirm mode switch</button></div></div></Dialog>}
  </main>;
}
