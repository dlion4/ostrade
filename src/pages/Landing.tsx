import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BookOpenCheck,
  Check,
  ChevronDown,
  ClipboardPaste,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  Minus,
  Network,
  Plus,
  Receipt,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  Split,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import css from "@/styles/pages/landing.css?inline";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/components/Toast";
import {
  getBrokers,
  getCapabilityMatrix,
  getFaq,
  getFeatures,
  getFlowSteps,
  getGuardrails,
  getJournalPreview,
  getPlatformStats,
  getSignalSamples,
  getTrustItems,
  type SignalSample,
} from "@/services/landing";
import { placeOrder, type PlaceOrderResult } from "@/services/orders";

/* ───────────────────────── helpers ───────────────────────── */

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

const FEATURE_ICONS: Record<string, LucideIcon> = { desk: ClipboardPaste, auto: Bot, hub: Network };
const STEP_ICONS: Record<string, LucideIcon> = { in: ClipboardPaste, parse: Split, guard: ShieldCheck, route: Route, fill: Receipt };

/* ───────────────────────── S1 · hero ───────────────────────── */

function HeroSignalCard() {
  const toast = useToast();
  const { data: samples, isPending, isError, refetch } = useQuery({ queryKey: ["signal-samples"], queryFn: getSignalSamples });
  const [activeId, setActiveId] = useState("s1");
  const [lots, setLots] = useState("0.10");
  const [result, setResult] = useState<PlaceOrderResult | null>(null);

  const sample: SignalSample | undefined = samples?.find((s) => s.id === activeId) ?? samples?.[0];

  useEffect(() => {
    if (sample) setLots(sample.lots);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample?.id]);

  const order = useMutation({
    mutationFn: placeOrder,
    onSuccess: (r) => {
      setResult(r);
      toast(r.simulated ? `Paper order filled · ${r.ref}` : "Ready — executes when the backend is connected");
    },
  });

  if (isError) return <QueryError title="Could not load sample signals" onRetry={() => refetch()} />;
  if (isPending || !sample) {
    return (
      <div className="os-demo" aria-busy="true">
        <Skel h={22} w="55%" className="mb-3" />
        <Skel h={110} className="mb-3" />
        <Skel h={220} />
      </div>
    );
  }

  const isPaper = sample.account.toLowerCase().startsWith("paper");
  const step = (d: number) => {
    const n = Math.max(0.01, Math.round((parseFloat(lots || "0") + d) * 100) / 100);
    setLots(n.toFixed(2));
    setResult(null);
  };

  return (
    <div className="os-demo">
      <div className="os-demo-chips" role="tablist" aria-label="Sample signals">
        {samples.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={s.id === sample.id}
            className={`os-chip ${s.id === sample.id ? "is-active" : ""}`}
            onClick={() => setActiveId(s.id)}
          >
            {s.symbol}
            <span className={s.side === "BUY" ? "os-up" : "os-down"}>{s.side === "BUY" ? "▲" : "▼"}</span>
          </button>
        ))}
      </div>

      <div className="os-demo-grid">
        <div className="os-bubble-wrap">
          <div className="os-demo-label">
            <span className="os-src-dot" /> {sample.source} · {sample.channel}
          </div>
          <div className="os-bubble os-mono">
            {sample.raw.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>

        <div className="os-parse-arrow" aria-hidden>
          <Sparkles size={16} />
          <span>Parsed</span>
        </div>

        <div className="os-order">
          <div className="os-order-top">
            <div>
              <div className="os-order-sym os-mono">{sample.symbol}</div>
              <div className="os-order-acct">{sample.account}</div>
            </div>
            <span className={`os-side ${sample.side === "BUY" ? "is-buy" : "is-sell"}`}>{sample.side}</span>
          </div>
          <dl className="os-order-grid">
            <div><dt>Entry</dt><dd className="os-mono">{sample.entry}</dd></div>
            <div><dt>Stop loss</dt><dd className="os-mono os-down">{sample.sl}</dd></div>
            <div><dt>Take profit</dt><dd className="os-mono os-up">{sample.tp}</dd></div>
            <div><dt>Risk : reward</dt><dd className="os-mono">{sample.rr}</dd></div>
          </dl>
          <div className="os-lots">
            <span className="os-lots-label">Lots <em>(editable)</em></span>
            <div className="os-stepper">
              <button type="button" onClick={() => step(-0.05)} aria-label="Decrease lots"><Minus size={14} /></button>
              <span className="os-mono" aria-live="polite">{lots}</span>
              <button type="button" onClick={() => step(0.05)} aria-label="Increase lots"><Plus size={14} /></button>
            </div>
          </div>

          {result ? (
            <div className={`os-result ${result.simulated ? "is-filled" : "is-ready"}`} role="status">
              <BadgeCheck size={18} aria-hidden />
              <div>
                <div className="fw-semibold">
                  {result.simulated ? <>Filled · <span className="os-mono">{result.ref}</span></> : "Ready — executes when the backend is connected"}
                </div>
                <div className="small text-secondary">
                  {result.simulated ? `${result.message} · ${result.filledAt}` : "Live broker submit is inert in this preview."}
                </div>
              </div>
              <span className="os-badge-sim">{result.simulated ? "SIMULATED" : "PREVIEW"}</span>
            </div>
          ) : (
            <button
              type="button"
              className="os-btn os-btn-primary w-100"
              disabled={order.isPending}
              onClick={() => order.mutate({ symbol: sample.symbol, side: sample.side, entry: sample.entry, sl: sample.sl, tp: sample.tp, lots, account: sample.account })}
            >
              {order.isPending ? (
                <><Loader2 size={17} className="os-spin" aria-hidden /> Sending…</>
              ) : (
                <><Zap size={17} aria-hidden /> {isPaper ? "Place on Paper" : "Review & place"}</>
              )}
            </button>
          )}
        </div>
      </div>
      <p className="os-demo-foot">Interactive demo with sample data. No real orders are sent.</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="os-hero" aria-labelledby="os-hero-title">
      <div className="os-hero-glow" aria-hidden />
      <div className="container position-relative">
        <div className="row align-items-center g-5">
          <div className="col-lg-6">
            <span className="os-pill os-stagger" style={{ ["--i" as string]: 0 }}>
              <span className="os-pulse" /> Signal-trading command center
            </span>
            <h1 id="os-hero-title" className="os-display os-stagger" style={{ ["--i" as string]: 1 }}>
              Your signals. <span>Every broker.</span> One click.
            </h1>
            <p className="os-hero-lead os-stagger" style={{ ["--i" as string]: 2 }}>
              Paste a signal from Telegram, TradingView, or your copy-trade provider and execute it on your Deriv, Exness (MT5),
              Alpaca or paper account. Automate it. Schedule it. Never babysit it.
            </p>
            <div className="d-flex flex-wrap gap-3 os-stagger" style={{ ["--i" as string]: 3 }}>
              <Link to="/auth/broker-connect" className="os-btn os-btn-primary os-btn-lg">
                <Zap size={18} aria-hidden /> Connect a Broker <ArrowRight size={18} aria-hidden />
              </Link>
              <Link to="/how-it-works" className="os-btn os-btn-ghost os-btn-lg">
                <FileText size={18} aria-hidden /> See the flow
              </Link>
            </div>
            <ul className="os-hero-points os-stagger" style={{ ["--i" as string]: 4 }}>
              <li><Check size={16} aria-hidden /> Free paper account</li>
              <li><Check size={16} aria-hidden /> No card needed</li>
              <li><Check size={16} aria-hidden /> You approve every trade</li>
            </ul>
          </div>
          <div className="col-lg-6 os-stagger" style={{ ["--i" as string]: 3 }}>
            <HeroSignalCard />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── S2 · trust bar ───────────────────────── */

function TrustBar() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["trust-items"], queryFn: getTrustItems });
  return (
    <section className="os-trust" aria-label="Integrations and security">
      <div className="container">
        <p className="os-trust-label">Built on official broker APIs</p>
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <ul className="os-trust-list">
            {isPending
              ? Array.from({ length: 6 }, (_, i) => <li key={i}><Skel h={38} w={150} /></li>)
              : data.map((t) => (
                  <li key={t}>
                    {t.includes("AES") ? <Lock size={15} aria-hidden /> : <BadgeCheck size={15} aria-hidden />}
                    {t}
                  </li>
                ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S3 · stats ───────────────────────── */

function Stats() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["platform-stats"], queryFn: getPlatformStats });
  return (
    <section className="os-section os-section-tight" aria-label="OStrade in numbers">
      <div className="container">
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <div className="row g-3 g-lg-4 row-cols-2 row-cols-lg-4">
            {isPending
              ? Array.from({ length: 4 }, (_, i) => <div className="col" key={i}><Skel h={150} className="rounded-4" /></div>)
              : data.map((s, i) => (
                  <div className="col" key={s.id}>
                    <Reveal delay={i * 80} className="os-stat h-100">
                      <div className="os-stat-num">
                        {s.prefix}<CountUp value={s.value} />{s.suffix}
                      </div>
                      <div className="os-stat-label">{s.label}</div>
                      <p className="os-stat-detail">{s.detail}</p>
                    </Reveal>
                  </div>
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S4 · feature cards ───────────────────────── */

function Features() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["features"], queryFn: getFeatures });
  return (
    <section className="os-section" aria-labelledby="os-features-title">
      <div className="container">
        <SectionHead
          eyebrow="What you get"
          title={<span id="os-features-title">Everything between a signal and a fill</span>}
          lead="OStrade is a signal hub, not a broker clone. Charts are context; the signal is the product."
        />
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <div className="row g-4 row-cols-1 row-cols-lg-3">
            {isPending
              ? Array.from({ length: 3 }, (_, i) => <div className="col" key={i}><Skel h={330} className="rounded-4" /></div>)
              : data.map((f, i) => {
                  const Icon = FEATURE_ICONS[f.id] ?? Sparkles;
                  return (
                    <div className="col" key={f.id}>
                      <Reveal delay={i * 90} className="h-100">
                        <article className={`os-feature is-${f.tone}`}>
                          <span className="os-feature-icon"><Icon size={24} aria-hidden /></span>
                          <h3>{f.title}</h3>
                          <p>{f.blurb}</p>
                          <ul>
                            {f.bullets.map((b) => (
                              <li key={b}><Check size={16} aria-hidden /> {b}</li>
                            ))}
                          </ul>
                          <Link to={f.to} className="os-link-arrow">
                            {f.cta} <ArrowRight size={16} aria-hidden />
                          </Link>
                        </article>
                      </Reveal>
                    </div>
                  );
                })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S5 · signal-to-trade strip ───────────────────────── */

function FlowStrip() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["flow-steps"], queryFn: getFlowSteps });
  return (
    <section className="os-section os-band" aria-labelledby="os-flow-title">
      <div className="container">
        <SectionHead
          eyebrow="Signal-to-trade"
          title={<span id="os-flow-title">Five steps, under a second</span>}
          lead="Every order takes the same safe path, whether it came from Telegram, a webhook or a schedule."
        />
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="row g-3 row-cols-1 row-cols-md-5">
            {Array.from({ length: 5 }, (_, i) => <div className="col" key={i}><Skel h={150} className="rounded-4" /></div>)}
          </div>
        ) : (
          <Reveal className="os-flow">
            <svg className="os-flow-line" width="100%" height="4" aria-hidden>
              <line x1="0" y1="2" x2="100%" y2="2" pathLength={1} />
            </svg>
            <ol className="os-flow-steps">
              {data.map((s, i) => {
                const Icon = STEP_ICONS[s.id] ?? Zap;
                return (
                  <li key={s.id} style={{ ["--i" as string]: i }}>
                    <span className="os-flow-node"><Icon size={22} aria-hidden /></span>
                    <span className="os-flow-n os-mono">0{i + 1}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S6 · broker grid ───────────────────────── */

function BrokerGrid() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["brokers"], queryFn: getBrokers });
  return (
    <section className="os-section" aria-labelledby="os-brokers-title">
      <div className="container">
        <SectionHead
          eyebrow="Broker Hub"
          title={<span id="os-brokers-title">12 brokers and venues, one command center</span>}
          lead="Native APIs where they exist, MetaApi for MT5. Each one shows how you connect and which accounts it supports."
        />
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4">
            {isPending
              ? Array.from({ length: 8 }, (_, i) => <div className="col" key={i}><Skel h={170} className="rounded-4" /></div>)
              : data.map((b, i) => (
                  <div className="col" key={b.id}>
                    <Reveal delay={(i % 4) * 60} className="h-100">
                      <article className="os-broker">
                        <div className="d-flex align-items-center gap-3 mb-3">
                          <span className={`os-broker-mark is-${b.tone}`} aria-hidden>{b.initials}</span>
                          <div className="min-w-0">
                            <h3 className="os-broker-name">{b.name}</h3>
                            <div className="os-broker-route">{b.route}</div>
                          </div>
                        </div>
                        <div className="os-broker-meta">
                          <span>Connect with</span>
                          <strong>{b.connect}</strong>
                        </div>
                        <div className="os-tags">
                          {b.assets.map((a) => <span key={a}>{a}</span>)}
                        </div>
                        <div className="os-broker-acc">{b.accounts.join(" · ")}</div>
                      </article>
                    </Reveal>
                  </div>
                ))}
          </div>
        )}
        <div className="text-center mt-5">
          <Link to="/brokers" className="os-btn os-btn-ghost">
            Compare all brokers <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── S7 · capability matrix ───────────────────────── */

function CapabilityMatrix() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["capability-matrix"], queryFn: getCapabilityMatrix });
  return (
    <section className="os-section os-band" aria-labelledby="os-matrix-title">
      <div className="container">
        <SectionHead
          eyebrow="Honest by design"
          title={<span id="os-matrix-title">We only do what your broker's API allows</span>}
          lead="OStrade shows a feature only where the broker supports it. Where an API says no, we deep-link or log it in your ledger instead."
        />
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : isPending ? (
          <Skel h={420} className="rounded-4" />
        ) : (
          <Reveal className="os-matrix-wrap">
            <div className="os-matrix-scroll" tabIndex={0} role="region" aria-label="Broker capability matrix">
              <table className="os-matrix">
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    {data.brokers.map((b) => <th scope="col" key={b}>{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <span className="os-cap-label">{r.label}</span>
                        <span className="os-cap-hint">{r.hint}</span>
                      </th>
                      {r.values.map((v, i) => (
                        <td key={i}>
                          <span className={`os-cap is-${v.v}`} title={`${data.brokers[i]}: ${v.v === "yes" ? "supported" : v.v === "no" ? "not available" : "limited"}${v.note ? ` (${v.note})` : ""}`}>
                            {v.v === "yes" ? <Check size={14} aria-label="Supported" /> : v.v === "no" ? <X size={14} aria-label="Not available" /> : <Minus size={14} aria-label="Limited" />}
                          </span>
                          {v.note && <span className="os-cap-note">{v.note}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="os-matrix-legend">
              <span><i className="os-cap is-yes"><Check size={12} /></i> Supported</span>
              <span><i className="os-cap is-partial"><Minus size={12} /></i> Limited or via workaround</span>
              <span><i className="os-cap is-no"><X size={12} /></i> Not offered by the API</span>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S8 · records journal ───────────────────────── */

function Journal() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["journal-preview"], queryFn: getJournalPreview });
  return (
    <section className="os-section" aria-labelledby="os-journal-title">
      <div className="container">
        <div className="row g-5 align-items-center">
          <div className="col-lg-5">
            <SectionHead
              center={false}
              eyebrow="Records journal"
              title={<span id="os-journal-title">Every action, written down</span>}
              lead="Manual, signal-driven and scheduled trades, plus deposits and withdrawals, land in one journal with a timestamp, account, reference and status."
            />
            <Reveal delay={100}>
              <ul className="os-checks">
                <li><Check size={18} aria-hidden /> Reference like <span className="os-mono">OST-2025-00123</span> on every order</li>
                <li><Check size={18} aria-hidden /> See which signal channel earned, and which lost</li>
                <li><Check size={18} aria-hidden /> Blocked trades keep the reason the guard gave</li>
              </ul>
              <Link to="/auth/signup" className="os-btn os-btn-dark mt-2">
                <BookOpenCheck size={17} aria-hidden /> Start your journal
              </Link>
            </Reveal>
          </div>
          <div className="col-lg-7">
            {isError ? (
              <QueryError onRetry={() => refetch()} />
            ) : isPending ? (
              <Skel h={460} className="rounded-4" />
            ) : (
              <Reveal className="os-journal">
                <div className="os-journal-head">
                  <strong>Today's records</strong>
                  <span className="os-badge-sim">SAMPLE DATA</span>
                </div>
                <table className="os-table">
                  <thead>
                    <tr><th>Ref</th><th>Time</th><th>Symbol</th><th>Side</th><th>Source</th><th>Status</th><th className="text-end">P&amp;L</th></tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r.ref}>
                        <td data-label="Ref" className="os-mono">{r.ref}</td>
                        <td data-label="Time" className="os-mono">{r.time}</td>
                        <td data-label="Symbol" className="os-mono fw-semibold">{r.symbol}</td>
                        <td data-label="Side"><span className={r.side === "BUY" ? "os-up fw-semibold" : "os-down fw-semibold"}>{r.side}</span></td>
                        <td data-label="Source">{r.source}</td>
                        <td data-label="Status"><span className={`os-status is-${r.status.toLowerCase()}`}>{r.status}</span></td>
                        <td data-label="P&L" className={`os-mono text-end ${r.pnl.startsWith("+") ? "os-up" : r.pnl.startsWith("−") ? "os-down" : ""}`}>{r.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── S9 · paper first ───────────────────────── */

const STAGES = [
  { id: "paper", label: "Paper", icon: FlaskConical, title: "Start on paper", text: "A simulated $10,000 account. Place trades, see fills with real-looking refs, and build a journal at zero risk.", badge: "SIMULATED", tone: "up" },
  { id: "demo", label: "Broker demo", icon: Sparkles, title: "Rehearse on a broker demo", text: "Deriv demo, MT5 trial, Alpaca paper, Binance testnet or OANDA practice. Same flow, the broker's own sandbox.", badge: "DEMO", tone: "quote" },
  { id: "live", label: "Live", icon: Rocket, title: "Go live when you're ready", text: "Switch the active account in the top bar. Guardrails, confirmations and the kill-switch stay on. Live submits execute once the backend is connected.", badge: "LIVE", tone: "brand" },
] as const;

function PaperFirst() {
  const [stage, setStage] = useState<(typeof STAGES)[number]["id"]>("paper");
  const toast = useToast();
  const cur = STAGES.find((s) => s.id === stage)!;
  const Icon = cur.icon;
  return (
    <section className="os-section os-band" aria-labelledby="os-paper-title">
      <div className="container">
        <SectionHead
          eyebrow="Paper first"
          title={<span id="os-paper-title">Start paper. Go live when you're ready.</span>}
          lead="Rehearse every strategy before it touches real money. One switch changes which account every trading screen uses."
        />
        <Reveal className="os-paper">
          <div className="os-seg" role="tablist" aria-label="Account stage">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={stage === s.id}
                className={stage === s.id ? "is-active" : ""}
                onClick={() => { setStage(s.id); toast(`Showing: ${s.label}`); }}
              >
                <s.icon size={16} aria-hidden /> {s.label}
              </button>
            ))}
          </div>
          <div className="os-paper-body" key={cur.id}>
            <span className={`os-paper-icon is-${cur.tone}`}><Icon size={28} aria-hidden /></span>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h3 className="mb-0">{cur.title}</h3>
                <span className={`os-badge-sim is-${cur.tone}`}>{cur.badge}</span>
              </div>
              <p className="mb-0 text-secondary">{cur.text}</p>
            </div>
            <Link to="/auth/signup" className="os-btn os-btn-primary">
              Open paper account <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── S10 · guardrails ───────────────────────── */

function Guardrails() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["guardrails"], queryFn: getGuardrails });
  return (
    <section className="os-section" aria-labelledby="os-guard-title">
      <div className="container">
        <SectionHead
          eyebrow="Risk & security"
          title={<span id="os-guard-title">Guardrails before every order</span>}
          lead="Automation is only useful if it can't hurt you. Ten checks run before anything reaches a broker."
        />
        {isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-5">
            {isPending
              ? Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={118} className="rounded-4" /></div>)
              : data.map((g, i) => (
                  <div className="col" key={g.id}>
                    <Reveal delay={(i % 5) * 50} className="h-100">
                      <div className="os-guard">
                        <span className="os-guard-n os-mono">{String(i + 1).padStart(2, "0")}</span>
                        <h3>{g.title}</h3>
                        <p>{g.text}</p>
                      </div>
                    </Reveal>
                  </div>
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── S11 · FAQ ───────────────────────── */

function Faq() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["faq"], queryFn: getFaq });
  const [open, setOpen] = useState<string | null>("f1");
  return (
    <section className="os-section os-band" aria-labelledby="os-faq-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <SectionHead
              center={false}
              eyebrow="FAQ"
              title={<span id="os-faq-title">Questions traders ask first</span>}
              lead="Still unsure? Read the full walkthrough or write to us."
            />
            <Reveal delay={80} className="d-flex flex-wrap gap-2">
              <Link to="/how-it-works" className="os-btn os-btn-ghost os-btn-sm">How it works</Link>
              <a href="mailto:hello@ostrade.app" className="os-btn os-btn-text os-btn-sm">hello@ostrade.app</a>
            </Reveal>
          </div>
          <div className="col-lg-8">
            {isError ? (
              <QueryError onRetry={() => refetch()} />
            ) : isPending ? (
              <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={62} className="rounded-4" />)}</div>
            ) : (
              <div className="os-faq">
                {data.map((f) => {
                  const isOpen = open === f.id;
                  return (
                    <div className={`os-faq-item ${isOpen ? "is-open" : ""}`} key={f.id}>
                      <h3>
                        <button type="button" aria-expanded={isOpen} aria-controls={`panel-${f.id}`} id={`btn-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}>
                          <span>{f.q}</span>
                          <ChevronDown size={20} aria-hidden />
                        </button>
                      </h3>
                      <div className="os-faq-panel" id={`panel-${f.id}`} role="region" aria-labelledby={`btn-${f.id}`}>
                        <div><p>{f.a}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── S12 · CTA ───────────────────────── */

function FinalCta() {
  return (
    <section className="os-section" aria-labelledby="os-cta-title">
      <div className="container">
        <Reveal className="os-cta">
          <h2 id="os-cta-title">Start paper. Go live when you're ready.</h2>
          <p>Create a free paper account in two minutes, paste your first signal, and watch it turn into a filled order with a journal entry.</p>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            <Link to="/auth/signup" className="os-btn os-btn-primary os-btn-lg">
              Create free account <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/auth/broker-connect" className="os-btn os-btn-cta-ghost os-btn-lg">
              Connect a broker
            </Link>
          </div>
          <small>Trading involves risk. Paper accounts use simulated money.</small>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function LandingPage() {
  usePageStyle("landing", css);
  return (
    <main className="page-landing">
      <Hero />
      <TrustBar />
      <Stats />
      <Features />
      <FlowStrip />
      <BrokerGrid />
      <CapabilityMatrix />
      <Journal />
      <PaperFirst />
      <Guardrails />
      <Faq />
      <FinalCta />
    </main>
  );
}
