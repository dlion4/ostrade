import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FilterX,
  FlaskConical,
  KeyRound,
  Landmark,
  Link2,
  LockKeyhole,
  Network,
  PlugZap,
  Route,
  Search,
  SearchX,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getBrokers, getCapabilityMatrix, type Broker } from "@/services/landing";
import {
  getBrokerDetail,
  getBrokerFaqs,
  getConnectionMethods,
  getDemoVenues,
  getSymbolMappings,
  type RailKind,
} from "@/services/brokers";
import css from "@/styles/pages/brokers.css?inline";

function SectionHead({ eyebrow, title, lead, center = true }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={`os-section-head ${center ? "text-center mx-auto" : ""}`}>
      <span className="os-eyebrow">{eyebrow}</span>
      <h2 className="os-h2">{title}</h2>
      {lead && <p className="os-lead">{lead}</p>}
    </Reveal>
  );
}

function Skel({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <span className={`os-skel ${className}`} style={{ height: h, width: w }} aria-hidden />;
}

function CapIcon({ value }: { value: "yes" | "no" | "partial" }) {
  return value === "yes" ? <Check size={14} aria-label="Supported" /> : value === "no" ? <X size={14} aria-label="Not available" /> : <SlidersHorizontal size={13} aria-label="Limited" />;
}

function goTo(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/* ───────────────────── S1 · Header ───────────────────── */

function HeroMappingCard() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["symbol-mappings"], queryFn: getSymbolMappings });
  const row = data?.find((r) => r.canonical === "EURUSD");
  const venues = [
    { name: "Deriv", code: row?.codes[0], type: "Contract adapter" },
    { name: "Exness / MT5", code: row?.codes[1], type: "Market order" },
    { name: "OANDA", code: row?.codes[5], type: "v20 order" },
  ];
  return (
    <div className="os-hero-card">
      <div className="os-hero-card-head">
        <span className="os-hero-card-icon"><Route size={20} aria-hidden /></span>
        <div><strong>One signal, correctly translated</strong><span>Symbol mapping preview</span></div>
        <span className="os-preview-badge">EXAMPLE</span>
      </div>
      {isError ? <QueryError title="Could not load the mapping" onRetry={() => refetch()} /> : isPending || !row ? (
        <div className="d-grid gap-3 mt-4"><Skel h={58} /><Skel h={58} /><Skel h={58} /></div>
      ) : (
        <>
          <div className="os-hero-signal">
            <span className="os-mono">EURUSD · BUY · 0.20</span>
            <span className="os-side-chip">SIGNAL</span>
          </div>
          <div className="os-route-list">
            {venues.map((v, i) => (
              <div className="os-route-row" key={v.name}>
                <span className="os-route-index os-mono">0{i + 1}</span>
                <div><strong>{v.name}</strong><span>{v.type}</span></div>
                <code>{v.code}</code>
              </div>
            ))}
          </div>
          <div className="os-hero-card-foot"><ShieldCheck size={16} aria-hidden /> The adapter validates the instrument before routing.</div>
        </>
      )}
    </div>
  );
}

function Header() {
  const brokers = useQuery({ queryKey: ["brokers"], queryFn: getBrokers });
  const matrix = useQuery({ queryKey: ["capability-matrix"], queryFn: getCapabilityMatrix });
  const stats = [
    { value: brokers.data?.length, label: "Brokers & venues" },
    { value: matrix.data?.rows.length, label: "Capabilities checked" },
    { value: 3, label: "Finance rail types" },
    { value: 1, label: "Paper-mode switch" },
  ];
  return (
    <section className="os-hero" aria-labelledby="os-brokers-hero-title">
      <div className="os-hero-glow" aria-hidden />
      <div className="container position-relative">
        <div className="row align-items-center g-5">
          <div className="col-lg-6">
            <span className="os-pill os-stagger" style={{ ["--i" as string]: 0 }}><Network size={15} aria-hidden /> Broker Hub · public capability guide</span>
            <h1 id="os-brokers-hero-title" className="os-display os-stagger" style={{ ["--i" as string]: 1 }}>
              Every broker with an API. <span>Exactly what they allow.</span>
            </h1>
            <p className="os-hero-lead os-stagger" style={{ ["--i" as string]: 2 }}>
              Connect Deriv, Exness/MT5, cTrader, Alpaca, Binance, OANDA and more. OStrade shows what each integration can do — and what it cannot — before you route a single order.
            </p>
            <div className="d-flex flex-wrap gap-3 os-stagger" style={{ ["--i" as string]: 3 }}>
              <Link to="/auth/broker-connect" className="os-btn os-btn-primary os-btn-lg"><PlugZap size={18} aria-hidden /> Connect your first broker <ArrowRight size={18} /></Link>
              <button type="button" className="os-btn os-btn-ghost os-btn-lg" onClick={() => goTo("capability-matrix")}>Compare capabilities</button>
            </div>
            <div className="os-hero-assurance os-stagger" style={{ ["--i" as string]: 4 }}>
              <LockKeyhole size={17} aria-hidden /> Your funds stay at your broker. Credentials belong in an AES-256 encrypted vault.
            </div>
          </div>
          <div className="col-lg-6 os-stagger" style={{ ["--i" as string]: 3 }}><HeroMappingCard /></div>
        </div>
        <div className="row g-3 row-cols-2 row-cols-lg-4 os-hero-stats os-stagger" style={{ ["--i" as string]: 5 }}>
          {stats.map((s) => (
            <div className="col" key={s.label}>
              <div className="os-mini-stat">
                <strong>{s.value === undefined ? <Skel h={34} w={50} /> : <CountUp value={s.value} />}</strong>
                <span>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── S2 · Connection methods ───────────────────── */

const METHOD_ICONS: Record<string, LucideIcon> = { oauth: BadgeCheck, token: KeyRound, mt5: Server, paper: FlaskConical };

function ConnectionMethods() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["connection-methods"], queryFn: getConnectionMethods });
  const [active, setActive] = useState("oauth");
  const current = data?.find((m) => m.id === active) ?? data?.[0];
  return (
    <section className="os-section os-band" aria-labelledby="os-methods-title">
      <div className="container">
        <SectionHead eyebrow="Connection methods" title={<span id="os-methods-title">Connect the way each broker intends</span>} lead="No shared password flow where OAuth exists, no withdrawal-enabled key where a trade-only key will do, and an MT5 bridge where MetaTrader is the API." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? (
          <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-lg-4">{Array.from({ length: 4 }, (_, i) => <div className="col" key={i}><Skel h={170} className="rounded-4" /></div>)}</div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-5">
              <div className="os-method-list" role="tablist" aria-label="Connection methods">
                {data.map((m) => {
                  const Icon = METHOD_ICONS[m.id] ?? Link2;
                  return (
                    <button key={m.id} type="button" role="tab" aria-selected={current?.id === m.id} className={`os-method-tab ${current?.id === m.id ? "is-active" : ""}`} onClick={() => setActive(m.id)}>
                      <span className="os-method-icon"><Icon size={21} aria-hidden /></span>
                      <span><strong>{m.name}</strong><small>{m.short}</small></span>
                      <ArrowRight size={17} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-lg-7">
              {current && (
                <div className="os-method-detail" key={current.id} role="tabpanel">
                  <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-4">
                    <div><span className="os-detail-kicker">Required connection</span><h3>{current.name}</h3></div>
                    <span className="os-preview-badge">READ-ONLY GUIDE</span>
                  </div>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <h4>Fields you will need</h4>
                      <ul className="os-field-list">{current.fields.map((f) => <li key={f}><FileCheck2 size={16} aria-hidden />{f}</li>)}</ul>
                      <h4 className="mt-4">Used by</h4>
                      <div className="os-tags">{current.usedBy.map((b) => <span key={b}>{b}</span>)}</div>
                    </div>
                    <div className="col-md-6">
                      <h4>Setup sequence</h4>
                      <ol className="os-setup-list">{current.steps.map((s, i) => <li key={s}><span className="os-mono">{i + 1}</span><p>{s}</p></li>)}</ol>
                    </div>
                  </div>
                  <p className="os-method-note"><ShieldCheck size={17} aria-hidden />{current.note}</p>
                  <Link to="/auth/broker-connect" className="os-btn os-btn-dark">Open connection setup <ArrowUpRight size={16} aria-hidden /></Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────── S3 · Broker directory + drawer ───────────────────── */

function BrokerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["broker-detail", id], queryFn: () => getBrokerDetail(id) });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [onClose]);

  return (
    <div className="os-drawer-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="os-drawer" role="dialog" aria-modal="true" aria-labelledby="os-drawer-title">
        <div className="os-drawer-head">
          <span className="os-preview-badge">CAPABILITY PROFILE</span>
          <button ref={closeRef} type="button" className="os-icon-btn" onClick={onClose} aria-label="Close broker details"><X size={19} /></button>
        </div>
        {isError ? <QueryError title="Could not load this broker" onRetry={() => refetch()} /> : isPending || !data ? (
          <div className="d-grid gap-3 p-4"><Skel h={55} /><Skel h={90} /><Skel h={330} /></div>
        ) : (
          <div className="os-drawer-body">
            <div className="d-flex align-items-center gap-3 mb-3">
              <span className={`os-broker-mark is-${data.broker.tone}`}>{data.broker.initials}</span>
              <div><h2 id="os-drawer-title">{data.broker.name}</h2><p>{data.broker.route} · {data.matrixName}</p></div>
            </div>
            <div className="os-drawer-facts">
              <div><span>Connection</span><strong>{data.broker.connect}</strong></div>
              <div><span>Accounts</span><strong>{data.broker.accounts.join(" · ")}</strong></div>
            </div>
            <div className="os-tags mb-4">{data.broker.assets.map((a) => <span key={a}>{a}</span>)}</div>
            <h3 className="os-drawer-subhead">What the integration allows</h3>
            <ul className="os-drawer-caps">
              {data.capabilities.map((c) => (
                <li key={c.id}>
                  <span className={`os-cap is-${c.value}`}><CapIcon value={c.value} /></span>
                  <div><strong>{c.label}</strong><small>{c.hint}</small></div>
                  {c.note && <em>{c.note}</em>}
                </li>
              ))}
            </ul>
            <div className="os-drawer-note"><LockKeyhole size={17} aria-hidden /><p>Nothing connects from this public page. Setup validates the account before any order permission is enabled.</p></div>
            <Link to="/auth/broker-connect" className="os-btn os-btn-primary w-100">Continue to connection setup <ArrowRight size={16} /></Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function BrokerCard({ broker, onInspect }: { broker: Broker; onInspect: () => void }) {
  return (
    <article className="os-broker">
      <div className="d-flex align-items-center gap-3 mb-3">
        <span className={`os-broker-mark is-${broker.tone}`} aria-hidden>{broker.initials}</span>
        <div><h3>{broker.name}</h3><p>{broker.route}</p></div>
      </div>
      <div className="os-broker-meta"><span>Connect with</span><strong>{broker.connect}</strong></div>
      <div className="os-tags">{broker.assets.map((a) => <span key={a}>{a}</span>)}</div>
      <div className="os-broker-bottom"><span>{broker.accounts.join(" · ")}</span><button type="button" onClick={onInspect}>View capabilities <ArrowUpRight size={15} aria-hidden /></button></div>
    </article>
  );
}

function BrokerDirectory() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["brokers"], queryFn: getBrokers });
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState("all");
  const [connect, setConnect] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const assets = Array.from(new Set(data?.flatMap((b) => b.assets) ?? [])).sort();
  const methods = Array.from(new Set(data?.map((b) => b.connect) ?? [])).sort();
  const filtered = (data ?? []).filter((b) => {
    const q = query.trim().toLowerCase();
    return (!q || `${b.name} ${b.route} ${b.assets.join(" ")}`.toLowerCase().includes(q)) && (asset === "all" || b.assets.includes(asset)) && (connect === "all" || b.connect === connect);
  });
  const hasFilters = query !== "" || asset !== "all" || connect !== "all";
  const clear = () => { setQuery(""); setAsset("all"); setConnect("all"); };
  return (
    <section className="os-section" aria-labelledby="os-directory-title">
      <div className="container">
        <SectionHead eyebrow="Broker directory" title={<span id="os-directory-title">Choose the account, know the route</span>} lead="Search all 12 venues, filter by market or connection type, then inspect the exact capability profile behind each card." />
        <Reveal className="os-filters">
          <div className="os-search"><Search size={18} aria-hidden /><label className="visually-hidden" htmlFor="broker-search">Search brokers</label><input id="broker-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search broker, API or market…" /></div>
          <div><label htmlFor="asset-filter">Market</label><select id="asset-filter" value={asset} onChange={(e) => setAsset(e.target.value)}><option value="all">All markets</option>{assets.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div><label htmlFor="connect-filter">Connection</label><select id="connect-filter" value={connect} onChange={(e) => setConnect(e.target.value)}><option value="all">All methods</option>{methods.map((m) => <option key={m}>{m}</option>)}</select></div>
          {hasFilters && <button type="button" className="os-clear" onClick={clear}><FilterX size={16} aria-hidden /> Clear</button>}
        </Reveal>
        {isError ? <QueryError title="Could not load the broker directory" onRetry={() => refetch()} /> : isPending ? (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4">{Array.from({ length: 8 }, (_, i) => <div className="col" key={i}><Skel h={235} className="rounded-4" /></div>)}</div>
        ) : (
          <>
            <p className="os-result-count" aria-live="polite">Showing <strong>{filtered.length}</strong> of {data.length} venues</p>
            {filtered.length === 0 ? (
              <div className="os-empty"><SearchX size={28} aria-hidden /><h3>No brokers match those filters</h3><p>Try another market or clear the search to see every venue.</p><button type="button" className="os-btn os-btn-primary" onClick={clear}>Clear all filters</button></div>
            ) : (
              <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4">
                {filtered.map((b, i) => <div className="col" key={b.id}><Reveal delay={(i % 4) * 50} className="h-100"><BrokerCard broker={b} onInspect={() => setSelected(b.id)} /></Reveal></div>)}
              </div>
            )}
          </>
        )}
      </div>
      {selected && <BrokerDrawer id={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

/* ───────────────────── S4 · Capability matrix ───────────────────── */

function CapabilityExplorer() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["capability-matrix"], queryFn: getCapabilityMatrix });
  const [query, setQuery] = useState("");
  const [limitsOnly, setLimitsOnly] = useState(false);
  const [focus, setFocus] = useState("all");
  const rows = (data?.rows ?? []).filter((r) => (!query || `${r.label} ${r.hint}`.toLowerCase().includes(query.toLowerCase())) && (!limitsOnly || r.values.some((v) => v.v !== "yes")));
  const hasFilters = query !== "" || limitsOnly || focus !== "all";
  return (
    <section className="os-section os-band" id="capability-matrix" aria-labelledby="os-matrix-title">
      <div className="container">
        <SectionHead eyebrow="Capability matrix" title={<span id="os-matrix-title">Honesty as a feature</span>} lead="A check means the API supports it. A slider means limited or workaround-based. A cross means OStrade will not offer the action for that venue." />
        <Reveal className="os-filters os-matrix-filters">
          <div className="os-search"><Search size={18} aria-hidden /><label className="visually-hidden" htmlFor="cap-search">Search capabilities</label><input id="cap-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a capability…" /></div>
          <div><label htmlFor="broker-focus">Highlight broker</label><select id="broker-focus" value={focus} onChange={(e) => setFocus(e.target.value)}><option value="all">All brokers</option>{data?.brokers.map((b, i) => <option value={String(i)} key={b}>{b}</option>)}</select></div>
          <button type="button" className={`os-limit-toggle ${limitsOnly ? "is-active" : ""}`} aria-pressed={limitsOnly} onClick={() => setLimitsOnly((v) => !v)}><SlidersHorizontal size={16} aria-hidden /> Limitations only</button>
          {hasFilters && <button type="button" className="os-clear" onClick={() => { setQuery(""); setLimitsOnly(false); setFocus("all"); }}><FilterX size={16} /> Clear</button>}
        </Reveal>
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <Skel h={480} className="rounded-4" /> : rows.length === 0 ? (
          <div className="os-empty"><SearchX size={28} /><h3>No matching capabilities</h3><p>Clear the search or include fully supported rows.</p><button type="button" className="os-btn os-btn-primary" onClick={() => { setQuery(""); setLimitsOnly(false); }}>Show all capabilities</button></div>
        ) : (
          <Reveal className="os-matrix-wrap">
            <div className="os-matrix-scroll" tabIndex={0} role="region" aria-label="Public broker capability matrix">
              <table className="os-matrix">
                <thead><tr><th scope="col">Capability</th>{data.brokers.map((b, i) => <th scope="col" key={b} className={focus === String(i) ? "is-focused" : ""}>{b}</th>)}</tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id}><th scope="row"><span className="os-cap-label">{r.label}</span><span className="os-cap-hint">{r.hint}</span></th>{r.values.map((v, i) => <td key={i} className={focus === String(i) ? "is-focused" : ""}><span className={`os-cap is-${v.v}`} title={`${data.brokers[i]}: ${v.v}${v.note ? ` · ${v.note}` : ""}`}><CapIcon value={v.v} /></span>{v.note && <span className="os-cap-note">{v.note}</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="os-matrix-legend"><span>{rows.length} of {data.rows.length} rows</span><span><i className="os-cap is-yes"><Check size={12} /></i>Supported</span><span><i className="os-cap is-partial"><SlidersHorizontal size={11} /></i>Limited</span><span><i className="os-cap is-no"><X size={12} /></i>Not offered</span></div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────────── S5 · Paper first ───────────────────── */

function PaperFirst() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["demo-venues"], queryFn: getDemoVenues });
  const [paper, setPaper] = useState(true);
  const toast = useToast();
  const flip = () => { setPaper((p) => !p); toast(paper ? "Preview: live accounts available" : "Preview: paper-only workspace"); };
  return (
    <section className="os-section" aria-labelledby="os-paper-title">
      <div className="container">
        <div className="row g-4 align-items-end mb-5">
          <div className="col-lg-8"><SectionHead center={false} eyebrow="Paper-first panel" title={<span id="os-paper-title">Paper trade every strategy first</span>} lead="Rehearse the same signal, risk and records workflow in a sandbox. Switching modes changes the account context, not the rules that protect you." /></div>
          <div className="col-lg-4"><Reveal className="os-paper-switch"><div><span>Workspace preview</span><strong>{paper ? "Paper only" : "Live available"}</strong></div><button type="button" role="switch" aria-checked={paper} aria-label="Paper-only workspace preview" className={paper ? "is-on" : ""} onClick={flip}><span /></button></Reveal></div>
        </div>
        <Reveal className={`os-mode-banner ${paper ? "is-paper" : "is-live"}`}>
          {paper ? <FlaskConical size={22} aria-hidden /> : <Zap size={22} aria-hidden />}
          <div><strong>{paper ? "Paper mode is on" : "Live account selection is available"}</strong><p>{paper ? "Every order in this preview is simulated and marked SIMULATED. No real funds can move." : "Live order submission remains inert until the backend is connected. Confirmations and guardrails still apply."}</p></div>
          <span className="os-preview-badge">{paper ? "SIMULATED" : "PREVIEW"}</span>
        </Reveal>
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-lg-3">{Array.from({ length: 6 }, (_, i) => <div className="col" key={i}><Skel h={160} className="rounded-4" /></div>)}</div> : (
          <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-lg-3">
            {data.map((v, i) => <div className="col" key={v.id}><Reveal delay={(i % 3) * 60} className="h-100"><article className="os-demo-venue"><div className="d-flex justify-content-between gap-2 align-items-center mb-2"><h3>{v.name}</h3><span>{v.environment}</span></div><strong>{v.markets}</strong><p>{v.detail}</p><small><Check size={14} aria-hidden />{paper ? "Available in paper-first mode" : "Demo remains available alongside live"}</small></article></Reveal></div>)}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────── S6 · Finance rails ───────────────────── */

const RAIL_ICONS: Record<RailKind, LucideIcon> = { api: Zap, "deep-link": ExternalLink, manual: FileCheck2, simulated: FlaskConical };

function FinanceRails() {
  const brokers = useQuery({ queryKey: ["brokers"], queryFn: getBrokers });
  const [selected, setSelected] = useState("deriv");
  const detail = useQuery({ queryKey: ["broker-detail", selected], queryFn: () => getBrokerDetail(selected) });
  return (
    <section className="os-section os-band" aria-labelledby="os-finance-title">
      <div className="container">
        <SectionHead eyebrow="Deposits & withdrawals" title={<span id="os-finance-title">Three finance flows. One complete ledger.</span>} lead="The broker decides which rail is possible. OStrade automates what the API permits, deep-links hosted cashiers, and records the rest with proof." />
        <Reveal><div className="os-venue-picker" role="tablist" aria-label="Choose broker finance capabilities">
          {brokers.isPending ? Array.from({ length: 6 }, (_, i) => <Skel key={i} h={38} w={110} />) : brokers.isError ? <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => brokers.refetch()}>Retry broker list</button> : brokers.data.map((b) => <button type="button" role="tab" aria-selected={selected === b.id} className={selected === b.id ? "is-active" : ""} key={b.id} onClick={() => setSelected(b.id)}>{b.name}</button>)}
        </div></Reveal>
        {detail.isError ? <QueryError title="Could not load finance capabilities" onRetry={() => detail.refetch()} /> : detail.isPending || !detail.data ? <div className="row g-3 row-cols-1 row-cols-lg-3">{Array.from({ length: 3 }, (_, i) => <div className="col" key={i}><Skel h={210} className="rounded-4" /></div>)}</div> : (
          <div key={selected}>
            <p className="os-finance-for">Finance availability for <strong>{detail.data.broker.name}</strong><span>Source: {detail.data.matrixName}</span></p>
            <div className="row g-3 row-cols-1 row-cols-lg-3">
              {detail.data.rails.map((r) => { const Icon = RAIL_ICONS[r.kind]; return <div className="col" key={r.id}><article className={`os-rail is-${r.kind}`}><div className="d-flex justify-content-between align-items-center mb-3"><span className="os-rail-icon"><Icon size={21} aria-hidden /></span><span className="os-rail-kind">{r.kind === "api" ? "API FLOW" : r.kind === "deep-link" ? "DEEP-LINK" : r.kind === "manual" ? "MANUAL RAIL" : "SIMULATED"}</span></div><span className="os-rail-label">{r.label}</span><h3>{r.title}</h3><p>{r.detail}</p></article></div>; })}
            </div>
          </div>
        )}
        <Reveal className="os-ledger-rule"><Landmark size={24} aria-hidden /><div><strong>The ledger is always automated, even when the broker rail is manual.</strong><p>Timestamp, account, amount, proof and reconciliation status stay together in Records.</p></div></Reveal>
      </div>
    </section>
  );
}

/* ───────────────────── S7 · Symbol mapping ───────────────────── */

function SymbolMapping() {
  const mappings = useQuery({ queryKey: ["symbol-mappings"], queryFn: getSymbolMappings });
  const matrix = useQuery({ queryKey: ["capability-matrix"], queryFn: getCapabilityMatrix });
  const [venue, setVenue] = useState("0");
  const [query, setQuery] = useState("");
  const index = Number(venue);
  const rows = (mappings.data ?? []).filter((r) => !query || `${r.canonical} ${r.assetClass}`.toLowerCase().includes(query.toLowerCase()));
  const error = mappings.isError || matrix.isError;
  return (
    <section className="os-section" aria-labelledby="os-symbol-title">
      <div className="container">
        <SectionHead eyebrow="Symbol normalization" title={<span id="os-symbol-title">Your signal says EURUSD. Your broker may not.</span>} lead="OStrade keeps one canonical symbol, resolves the venue's instrument, and blocks the order if no valid mapping exists. These are illustrative mappings; MT5 suffixes depend on the account." />
        <Reveal className="os-filters os-symbol-filters">
          <div className="os-search"><Search size={18} /><label className="visually-hidden" htmlFor="symbol-search">Search symbols</label><input id="symbol-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search EURUSD, gold, crypto…" /></div>
          <div><label htmlFor="symbol-venue">Show broker code for</label><select id="symbol-venue" value={venue} onChange={(e) => setVenue(e.target.value)}>{matrix.data?.brokers.map((b, i) => <option value={i} key={b}>{b}</option>)}</select></div>
          {(query || venue !== "0") && <button type="button" className="os-clear" onClick={() => { setQuery(""); setVenue("0"); }}><FilterX size={16} /> Reset</button>}
        </Reveal>
        {error ? <QueryError title="Could not load symbol mappings" onRetry={() => { mappings.refetch(); matrix.refetch(); }} /> : mappings.isPending || matrix.isPending ? <Skel h={460} className="rounded-4" /> : rows.length === 0 ? (
          <div className="os-empty"><SearchX size={28} /><h3>No matching symbols</h3><p>Try a canonical pair such as EURUSD or XAUUSD.</p><button type="button" className="os-btn os-btn-primary" onClick={() => setQuery("")}>Clear symbol search</button></div>
        ) : (
          <Reveal className="os-symbol-table-wrap">
            <table className="os-symbol-table">
              <thead><tr><th>Canonical signal</th><th>Market</th><th>{matrix.data.brokers[index]} instrument</th><th>Mapping note</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.canonical}><td data-label="Signal" className="os-mono">{r.canonical}</td><td data-label="Market"><span className="os-asset-chip">{r.assetClass}</span></td><td data-label="Broker code">{r.codes[index] ? <code>{r.codes[index]}</code> : <span className="os-unmapped"><X size={14} /> Not available</span>}</td><td data-label="Note">{r.note}</td></tr>)}</tbody>
            </table>
            <div className="os-table-foot"><Route size={16} aria-hidden /> Unmapped instruments are blocked and recorded — never silently substituted.</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────────── S8 · Security & readiness ───────────────────── */

function Security() {
  const steps = [
    { n: "01", title: "Choose environment", text: "Start with paper, demo or testnet. Live is a deliberate later choice." },
    { n: "02", title: "Grant narrow access", text: "Use OAuth or trade-only credentials. Keep withdrawals disabled on keys." },
    { n: "03", title: "Validate the account", text: "Check the server, account currency, leverage and resolved symbols before trading." },
    { n: "04", title: "Test, then enable", text: "Send a paper order, inspect the journal entry, and only then enable automation." },
  ];
  return (
    <section className="os-section os-band" aria-labelledby="os-security-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-7">
            <SectionHead center={false} eyebrow="Connection readiness" title={<span id="os-security-title">Two minutes to connect. Four checks before live.</span>} lead="The fastest setup is still a careful setup. OStrade treats account validation and a paper rehearsal as part of connecting, not optional homework." />
            <ol className="os-readiness">{steps.map((s, i) => <Reveal as="li" delay={i * 70} key={s.n}><span className="os-mono">{s.n}</span><div><h3>{s.title}</h3><p>{s.text}</p></div></Reveal>)}</ol>
          </div>
          <div className="col-lg-5">
            <Reveal className="os-vault-card">
              <span className="os-vault-icon"><LockKeyhole size={26} aria-hidden /></span>
              <h3>Credential vault rules</h3>
              <p>Built for the backend security model, explained here before you enter anything.</p>
              <ul><li><Check size={16} />AES-256 encrypted credential storage</li><li><Check size={16} />Secrets never copied into signals or journals</li><li><Check size={16} />Trade-only scopes wherever possible</li><li><Check size={16} />Revoke access at OStrade or the broker</li></ul>
              <div className="os-never"><X size={17} aria-hidden /><span>Never paste API secrets into Telegram, a support message or a signal note.</span></div>
              <span className="os-preview-badge">PUBLIC GUIDE · NO CREDENTIALS COLLECTED</span>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── S9 · FAQ ───────────────────── */

function BrokerFaq() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["broker-faqs"], queryFn: getBrokerFaqs });
  const [open, setOpen] = useState<string | null>("bf1");
  return (
    <section className="os-section" aria-labelledby="os-faq-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4"><SectionHead center={false} eyebrow="Broker FAQ" title={<span id="os-faq-title">Before you hand over a key</span>} lead="Straight answers about permissions, symbols, demo accounts and where your money actually stays." /><Reveal delay={80}><a href="mailto:hello@ostrade.app" className="os-btn os-btn-ghost os-btn-sm">Ask about your broker <ArrowUpRight size={15} /></a></Reveal></div>
          <div className="col-lg-8">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={62} className="rounded-4" />)}</div> : <div className="os-faq">{data.map((f) => { const isOpen = open === f.id; return <div className={`os-faq-item ${isOpen ? "is-open" : ""}`} key={f.id}><h3><button type="button" aria-expanded={isOpen} aria-controls={`broker-panel-${f.id}`} id={`broker-btn-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}><span>{f.q}</span><ChevronDown size={20} /></button></h3><div className="os-faq-panel" id={`broker-panel-${f.id}`} role="region" aria-labelledby={`broker-btn-${f.id}`}><div><p>{f.a}</p></div></div></div>; })}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── S10 · CTA ───────────────────── */

function FinalCta() {
  return (
    <section className="os-section os-cta-section" aria-labelledby="os-cta-title">
      <div className="container"><Reveal className="os-cta"><span className="os-cta-icon"><PlugZap size={26} aria-hidden /></span><h2 id="os-cta-title">Connect your first broker — takes 2 minutes.</h2><p>Start with paper or a broker demo, inspect every capability, and go live only when the workflow feels boringly familiar.</p><div className="d-flex flex-wrap gap-3 justify-content-center"><Link to="/auth/broker-connect" className="os-btn os-btn-primary os-btn-lg">Connect a broker <ArrowRight size={18} /></Link><Link to="/auth/signup" className="os-btn os-btn-cta-ghost os-btn-lg">Start on paper</Link></div><small><WalletCards size={14} aria-hidden /> Your funds stay at your broker. Trading involves risk.</small></Reveal></div>
    </section>
  );
}

export function BrokersPage() {
  usePageStyle("brokers", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Brokers & Capabilities · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-brokers">
      <Header />
      <ConnectionMethods />
      <BrokerDirectory />
      <CapabilityExplorer />
      <PaperFirst />
      <FinanceRails />
      <SymbolMapping />
      <Security />
      <BrokerFaq />
      <FinalCta />
    </main>
  );
}
