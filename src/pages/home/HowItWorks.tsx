import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  FileCheck2,
  Hourglass,
  Inbox,
  Landmark,
  Link2,
  PauseCircle,
  RadioTower,
  RotateCcw,
  Route,
  ShieldCheck,
  Split,
  ThumbsDown,
  ThumbsUp,
  WalletCards,
  Workflow,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getAnatomyMarkers,
  getAutomationModels,
  getCopilotSuggestions,
  getDisconnectSequence,
  getFinanceLanes,
  getGuardScenarios,
  getHeroSamples,
  getPipeline,
  getRecordStates,
  getSchedulerQueue,
  getSchedulePool,
  getHowFaqs,
  SCHEDULER_BULK,
  SCHEDULER_MAX,
  type ScheduledItem,
} from "@/services/howItWorks";
import css from "@/styles/pages/how-it-works.css?inline";

/* ───────────────── helpers ───────────────── */

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

const STAGE_ICONS: Record<string, LucideIcon> = { inbox: Inbox, split: Split, shield: ShieldCheck, route: Route, zap: Zap, book: BookOpenCheck };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ───────────────── S1 · hero with staged signal ───────────────── */

function StagingCard() {
  const stagesQ = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  const samplesQ = useQuery({ queryKey: ["hero-samples"], queryFn: getHeroSamples });
  const [active, setActive] = useState("s1");
  const [runId, setRunId] = useState(0);
  const [progress, setProgress] = useState(0);
  const stages = stagesQ.data ?? [];
  const sample = samplesQ.data?.find((s) => s.id === active) ?? samplesQ.data?.[0];
  const done = stages.length > 0 && progress >= stages.length;

  useEffect(() => {
    if (!stages.length) return;
    setProgress(reducedMotion() ? stages.length : 0);
    if (reducedMotion()) return;
    const iv = window.setInterval(() => {
      setProgress((p) => {
        if (p >= stages.length) {
          window.clearInterval(iv);
          return p;
        }
        return p + 1;
      });
    }, 520);
    return () => window.clearInterval(iv);
  }, [runId, sample?.id, stages.length]);

  if (stagesQ.isError || samplesQ.isError) return <QueryError title="Could not load the demo" onRetry={() => { stagesQ.refetch(); samplesQ.refetch(); }} />;
  if (stagesQ.isPending || samplesQ.isPending || !sample) {
    return <div className="os-stage-card" aria-busy="true"><Skel h={24} w="60%" className="mb-3" /><Skel h={300} /></div>;
  }

  return (
    <div className="os-stage-card">
      <div className="os-stage-head">
        <div className="os-stage-tabs" role="tablist" aria-label="Signal format">
          {samplesQ.data.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === sample.id} className={s.id === sample.id ? "is-active" : ""} onClick={() => setActive(s.id)}>
              {s.source}
            </button>
          ))}
        </div>
        <button type="button" className="os-replay" onClick={() => setRunId((r) => r + 1)} aria-label="Replay the staging demo">
          <RotateCcw size={14} aria-hidden /> Replay
        </button>
      </div>

      <div className="os-stage-signal">
        <span className="os-stage-signal-src">{sample.source} · {sample.channel}</span>
        <div className="os-stage-raw os-mono">{sample.raw.map((l) => <div key={l}>{l}</div>)}</div>
      </div>

      <ol className="os-stage-steps">
        {stages.map((st, i) => {
          const state = i < progress ? "done" : i === progress ? "active" : "todo";
          const Icon = STAGE_ICONS[st.icon] ?? Zap;
          return (
            <li key={st.id} className={`is-${state}`}>
              <span className="os-stage-node" aria-hidden>{state === "done" ? <Check size={13} /> : <Icon size={14} />}</span>
              <div className="os-stage-step-text">
                <strong>{st.title}</strong>
                {state === "done" && <span className="os-mono os-stage-out">→ {st.output}</span>}
              </div>
              <span className="os-stage-ms os-mono">{st.ms === 0 ? "0ms" : `${st.ms}ms`}</span>
            </li>
          );
        })}
      </ol>

      <div className={`os-stage-order ${done ? "is-in" : ""}`} aria-hidden={!done}>
        <div className="os-stage-order-top">
          <span className="os-mono os-stage-sym">{sample.symbol}</span>
          <span className={`os-side ${sample.side === "BUY" ? "is-buy" : "is-sell"}`}>{sample.side}</span>
        </div>
        <div className="os-stage-grid">
          <div><span>Entry</span><strong className="os-mono">{sample.entry}</strong></div>
          <div><span>Stop loss</span><strong className="os-mono os-down">{sample.sl}</strong></div>
          <div><span>Take profit</span><strong className="os-mono os-up">{sample.tp}</strong></div>
          <div><span>Lots</span><strong className="os-mono">{sample.lots}</strong></div>
        </div>
        <div className="os-stage-order-foot">
          <span><CheckCircle2 size={14} aria-hidden /> Staged for {sample.account}</span>
          <span className="os-example-badge">EXAMPLE · NOTHING SENT</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const stagesQ = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  const stages = stagesQ.data ?? [];
  return (
    <section className="os-hero" aria-labelledby="os-hiw-title">
      <div className="os-hero-dots" aria-hidden />
      <div className="os-hero-glow" aria-hidden />
      <div className="container position-relative">
        <div className="row align-items-center g-5">
          <div className="col-lg-6">
            <span className="os-pill os-stagger" style={{ ["--i" as string]: 0 }}><Workflow size={15} aria-hidden /> How OStrade works</span>
            <h1 id="os-hiw-title" className="os-display os-stagger" style={{ ["--i" as string]: 1 }}>
              From signal to fill <span>in under a second.</span>
            </h1>
            <p className="os-hero-lead os-stagger" style={{ ["--i" as string]: 2 }}>
              Six stages stand between a pasted message and a journaled trade: ingest, parse, guard, route, execute, record. Watch the pipeline stage a real Telegram signal into a ready order card — then see what each stage protects.
            </p>
            <div className="d-flex flex-wrap gap-3 os-stagger" style={{ ["--i" as string]: 3 }}>
              <Link to="/auth/signup" className="os-btn os-btn-primary os-btn-lg"><ClipboardPaste size={18} aria-hidden /> Paste your first signal <ArrowRight size={18} /></Link>
              <Link to="/brokers" className="os-btn os-btn-ghost os-btn-lg">Compare brokers</Link>
            </div>
            <div className="os-timing os-stagger" style={{ ["--i" as string]: 4 }} aria-label="Typical pipeline latency">
              <span className="os-timing-label">Typical run</span>
              {stagesQ.isPending ? <Skel h={26} w={260} /> : (
                <>
                  {stages.slice(1).map((s, i) => {
                    const delta = s.ms - stages[i].ms;
                    return <span key={s.id} className="os-timing-chip os-mono">{s.title} +{delta}ms</span>;
                  })}
                  <span className="os-timing-total os-mono">≈ {stages[stages.length - 1]?.ms}ms</span>
                </>
              )}
            </div>
          </div>
          <div className="col-lg-6 os-stagger" style={{ ["--i" as string]: 3 }}>
            <StagingCard />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S2 · pipeline detail ───────────────── */

function Pipeline() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  return (
    <section className="os-section" aria-labelledby="os-pipeline-title">
      <div className="container">
        <SectionHead eyebrow="The pipeline" title={<span id="os-pipeline-title">Six stages, one contract each</span>} lead="Every stage takes one input and produces one output. If anything looks wrong, the chain stops there — with the reason attached." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? (
          <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-3">{Array.from({ length: 6 }, (_, i) => <div className="col" key={i}><Skel h={190} className="rounded-4" /></div>)}</div>
        ) : (
          <ol className="os-pipeline">
            {data.map((s, i) => {
              const Icon = STAGE_ICONS[s.icon] ?? Zap;
              return (
                <Reveal as="li" delay={(i % 3) * 80} key={s.id} className="os-pipe-card">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="os-pipe-icon"><Icon size={20} aria-hidden /></span>
                    <span className="os-pipe-n os-mono">0{i + 1}</span>
                    <h3>{s.title}</h3>
                    <span className="os-pipe-ms os-mono">{s.ms}ms</span>
                  </div>
                  <div className="os-pipe-io">
                    <span className="os-io os-io-in">{s.input}</span>
                    <ArrowRight size={15} aria-hidden />
                    <span className="os-io os-io-out">{s.output}</span>
                  </div>
                  <p>{s.detail}</p>
                </Reveal>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S3 · order card anatomy ───────────────── */

function Anatomy() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["anatomy-markers"], queryFn: getAnatomyMarkers });
  const [active, setActive] = useState(1);
  return (
    <section className="os-section os-band" aria-labelledby="os-anatomy-title">
      <div className="container">
        <SectionHead eyebrow="The order card" title={<span id="os-anatomy-title">One card. Every decision on it.</span>} lead="Signals become this card before anything executes. Hover the markers to see what each part is for — and where you stay in control." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-4"><div className="col-lg-6"><Skel h={430} className="rounded-4" /></div><div className="col-lg-6"><Skel h={430} className="rounded-4" /></div></div> : (
          <div className="row g-4 g-lg-5 align-items-start">
            <div className="col-lg-6">
              <Reveal className="os-anatomy-stage">
                <div className="os-anatomy-card">
                  <span className={`os-marker os-marker-1 ${active === 1 ? "is-active" : ""}`} onMouseEnter={() => setActive(1)} onFocus={() => setActive(1)} tabIndex={0}>1</span>
                  <div className="os-anatomy-top">
                    <div><strong className="os-mono">XAUUSD</strong><span>Exness MT5 · Trial</span></div>
                    <span className="os-side is-buy">BUY</span>
                    <span className={`os-marker os-marker-inline ${active === 4 ? "is-active" : ""}`} onMouseEnter={() => setActive(4)} onFocus={() => setActive(4)} tabIndex={0}>4</span>
                  </div>
                  <span className={`os-marker os-marker-2 ${active === 2 ? "is-active" : ""}`} onMouseEnter={() => setActive(2)} onFocus={() => setActive(2)} tabIndex={0}>2</span>
                  <div className="os-anatomy-grid">
                    <div><span>Entry</span><strong className="os-mono">2385.50</strong></div>
                    <div><span>Stop loss</span><strong className="os-mono os-down">2378.00</strong></div>
                    <div><span>Take profit</span><strong className="os-mono os-up">2402.00</strong></div>
                    <div><span>R : R</span><strong className="os-mono">1 : 2.2</strong></div>
                  </div>
                  <span className={`os-marker os-marker-3 ${active === 3 ? "is-active" : ""}`} onMouseEnter={() => setActive(3)} onFocus={() => setActive(3)} tabIndex={0}>3</span>
                  <div className="os-anatomy-risk">
                    <div><span>Lots</span><strong className="os-mono">0.10</strong></div>
                    <div><span>Risk</span><strong className="os-mono">0.75%</strong></div>
                    <div><span>To SL</span><strong className="os-mono">75 pips</strong></div>
                  </div>
                  <span className={`os-marker os-marker-5 ${active === 5 ? "is-active" : ""}`} onMouseEnter={() => setActive(5)} onFocus={() => setActive(5)} tabIndex={0}>5</span>
                  <div className="os-anatomy-confirm"><Check size={15} aria-hidden /> Review &amp; place trade</div>
                  <span className={`os-marker os-marker-6 ${active === 6 ? "is-active" : ""}`} onMouseEnter={() => setActive(6)} onFocus={() => setActive(6)} tabIndex={0}>6</span>
                  <div className="os-anatomy-foot os-mono">Ref OST-2025-00146 · Signal: Gold Desk VIP</div>
                </div>
                <p className="os-anatomy-caption">Illustrative card. Fields, risk readout and confirmations match the real trade ticket.</p>
              </Reveal>
            </div>
            <div className="col-lg-6">
              <div className="os-anatomy-list">
                {data.map((m, i) => (
                  <Reveal key={m.id} delay={i * 60}>
                    <button type="button" className={`os-anatomy-item ${active === m.id ? "is-active" : ""}`} onMouseEnter={() => setActive(m.id)} onFocus={() => setActive(m.id)} onClick={() => setActive(m.id)} aria-pressed={active === m.id}>
                      <span className="os-anatomy-n os-mono">{m.id}</span>
                      <div><strong>{m.title}</strong><p>{m.text}</p></div>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S4 · automation models ───────────────── */

function RulesMock() {
  const toast = useToast();
  const [rules, setRules] = useState([
    { id: "r1", text: "IF Gold Desk VIP posts XAUUSD → 0.10 lots on Exness Trial", on: true },
    { id: "r2", text: "IF FX Pulse Africa posts EURUSD → 0.20 lots on Paper", on: true },
    { id: "r3", text: "IF any channel posts R_10 → 1.00 on Deriv Demo, max 3/day", on: false },
  ]);
  const flip = (id: string) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));
    const r = rules.find((x) => x.id === id)!;
    toast(r.on ? "Rule paused — it will not fire" : "Rule resumed");
  };
  return (
    <div className="os-rules-mock">
      {rules.map((r) => (
        <div className={`os-rule-row ${r.on ? "" : "is-paused"}`} key={r.id}>
          <span className="os-mono os-rule-kw">IF</span>
          <span className="os-rule-text">{r.text}</span>
          <button type="button" role="switch" aria-checked={r.on} aria-label={r.on ? "Pause rule" : "Resume rule"} className={`os-mini-switch ${r.on ? "is-on" : ""}`} onClick={() => flip(r.id)}><span /></button>
        </div>
      ))}
      <div className="os-mock-foot"><PauseCircle size={14} aria-hidden /> Every rule pauses independently. The kill-switch pauses all.</div>
    </div>
  );
}

function SchedulesMock() {
  return (
    <div className="os-sched-mock">
      <div className="os-sched-meter-mini"><div className="os-sched-fill-mini" style={{ width: "36%" }} /></div>
      <div className="d-flex justify-content-between os-mono os-sched-count"><span>18 / 50 slots</span><span>bulk paste ×20</span></div>
      <div className="os-sched-next">
        <div><strong className="os-mono">XAUUSD BUY 0.10</strong><span>Mon 09:30 · Exness Trial</span></div>
        <div><strong className="os-mono">EURUSD SELL 0.20</strong><span>Mon 10:00 · Paper</span></div>
      </div>
    </div>
  );
}

function CopilotMock() {
  const toast = useToast();
  const suggQ = useQuery({ queryKey: ["copilot-suggestions"], queryFn: getCopilotSuggestions });
  const [decisions, setDecisions] = useState<Record<string, "approved" | "dismissed">>({});
  if (suggQ.isPending) return <div className="d-grid gap-2"><Skel h={58} /><Skel h={58} /></div>;
  if (suggQ.isError) return <QueryError title="Could not load suggestions" onRetry={() => suggQ.refetch()} />;
  const decide = (id: string, v: "approved" | "dismissed") => {
    setDecisions((d) => ({ ...d, [id]: v }));
    toast(v === "approved" ? "Draft approved — logged for the record" : "Draft dismissed");
  };
  return (
    <div className="os-copilot-mock">
      {suggQ.data.map((s) => {
        const d = decisions[s.id];
        return (
          <div className="os-copilot-row" key={s.id}>
            <div className="os-copilot-head">
              <Bot size={15} aria-hidden />
              <strong>{s.title}</strong>
              <span className={`os-conf is-${s.confidence.toLowerCase()}`}>{s.confidence}</span>
            </div>
            <p>{s.reason}</p>
            {d ? (
              <span className={`os-decision is-${d}`}>{d === "approved" ? <><Check size={14} /> Approved</> : <><X size={14} /> Dismissed</>}</span>
            ) : (
              <div className="os-copilot-actions">
                <button type="button" className="os-mini-btn is-approve" onClick={() => decide(s.id, "approved")}><ThumbsUp size={14} /> Approve</button>
                <button type="button" className="os-mini-btn is-dismiss" onClick={() => decide(s.id, "dismissed")}><ThumbsDown size={14} /> Dismiss</button>
              </div>
            )}
          </div>
        );
      })}
      <div className="os-mock-foot"><ShieldCheck size={14} aria-hidden /> The co-pilot drafts. You decide. Nothing runs unattended.</div>
    </div>
  );
}

function Automation() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["automation-models"], queryFn: getAutomationModels });
  const mocks: Record<string, ReactNode> = { rules: <RulesMock />, schedules: <SchedulesMock />, copilot: <CopilotMock /> };
  const icons: Record<string, LucideIcon> = { rules: Workflow, schedules: CalendarClock, copilot: Bot };
  return (
    <section className="os-section" aria-labelledby="os-auto-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <div className="os-sticky-head">
              <SectionHead center={false} eyebrow="Automation models" title={<span id="os-auto-title">Three ways to stop babysitting</span>} lead="Rules react to channels. Schedules wait for moments. The co-pilot reads your journal and drafts — you approve. Mix all three; guardrails sit above all of them." />
              <Reveal delay={100}><Link to="/auth/signup" className="os-btn os-btn-dark">Set up automation <ArrowRight size={16} aria-hidden /></Link></Reveal>
            </div>
          </div>
          <div className="col-lg-8">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-4">{Array.from({ length: 3 }, (_, i) => <Skel key={i} h={300} className="rounded-4" />)}</div> : (
              <div className="os-models">
                {data.map((m, i) => {
                  const Icon = icons[m.id] ?? Workflow;
                  return (
                    <Reveal key={m.id} delay={i * 90}>
                      <article className={`os-model is-${m.tone}`}>
                        <div className="os-model-head">
                          <span className="os-model-icon"><Icon size={22} aria-hidden /></span>
                          <div><h3>{m.name}</h3><span>{m.tagline}</span></div>
                        </div>
                        <p className="os-model-blurb">{m.blurb}</p>
                        <ul className="os-model-points">{m.points.map((p) => <li key={p}><Check size={15} aria-hidden />{p}</li>)}</ul>
                        <div className="os-model-mock">{mocks[m.id]}</div>
                      </article>
                    </Reveal>
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

/* ───────────────── S5 · scheduler lab ───────────────── */

function SchedulerLab() {
  const queueQ = useQuery({ queryKey: ["scheduler-queue"], queryFn: getSchedulerQueue });
  const poolQ = useQuery({ queryKey: ["schedule-pool"], queryFn: getSchedulePool });
  const toast = useToast();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const poolIdx = useRef(0);
  const uid = useRef(100);

  useEffect(() => {
    if (queueQ.data && !hydrated) {
      setItems(queueQ.data);
      setHydrated(true);
    }
  }, [queueQ.data, hydrated]);

  const count = items.length;
  const free = SCHEDULER_MAX - count;
  const pct = Math.round((count / SCHEDULER_MAX) * 100);
  const meterTone = pct >= 100 ? "is-full" : pct >= 80 ? "is-warn" : "";

  const addOne = () => {
    if (!poolQ.data) return;
    if (free <= 0) {
      setNotice(`Scheduler is full — ${SCHEDULER_MAX}/${SCHEDULER_MAX} slots in use. Close or delete a trade before adding another.`);
      toast("Scheduler full — 50 / 50 slots");
      return;
    }
    setNotice(null);
    const tpl = poolQ.data[poolIdx.current % poolQ.data.length];
    poolIdx.current += 1;
    uid.current += 1;
    setItems((xs) => [...xs, { ...tpl, id: `qx${uid.current}` }]);
    toast(`Scheduled ${tpl.symbol} · ${count + 1} / ${SCHEDULER_MAX}`);
  };

  const bulkPaste = () => {
    if (!poolQ.data) return;
    if (free < SCHEDULER_BULK) {
      setNotice(`${count} / ${SCHEDULER_MAX} slots in use — a bulk paste needs ${SCHEDULER_BULK} free slots, but only ${free} remain. Add trades one by one or clear the queue first.`);
      toast(`Blocked — only ${free} of ${SCHEDULER_BULK} slots free`);
      return;
    }
    setNotice(null);
    const batch: ScheduledItem[] = Array.from({ length: SCHEDULER_BULK }, (_, i) => {
      const tpl = poolQ.data[(poolIdx.current + i) % poolQ.data.length];
      uid.current += 1;
      return { ...tpl, id: `qx${uid.current}` };
    });
    poolIdx.current += SCHEDULER_BULK;
    setItems((xs) => [...xs, ...batch]);
    toast(`Bulk paste — 20 trades queued · ${count + SCHEDULER_BULK} / ${SCHEDULER_MAX}`);
  };

  const clearAll = () => {
    if (count === 0) {
      setNotice("The queue is already empty.");
      toast("Queue already empty");
      return;
    }
    setItems([]);
    setNotice(null);
    toast("Queue cleared — 0 / 50 slots");
  };

  const shown = items.slice(0, 7);

  return (
    <section className="os-section os-band" aria-labelledby="os-sched-title">
      <div className="container">
        <SectionHead eyebrow="Scheduler lab" title={<span id="os-sched-title">50 slots. 20 at a time. Never a silent drop.</span>} lead="Try the real constraints: add one trade, bulk-paste twenty, and watch the meter enforce the cap with a message you can act on." />
        <Reveal className="os-sched-lab">
          <div className="os-sched-top">
            <div className="os-sched-meter-wrap">
              <div className={`os-sched-meter ${meterTone}`} role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={SCHEDULER_MAX} aria-label="Scheduler slots used">
                <div className="os-sched-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="os-sched-readout os-mono"><strong>{count} / {SCHEDULER_MAX}</strong> slots · {free} free</div>
            </div>
            <div className="os-sched-actions">
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={addOne} disabled={queueQ.isPending}>+ Add one</button>
              <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={bulkPaste} disabled={queueQ.isPending || poolQ.isPending}><ClipboardPaste size={15} aria-hidden /> Bulk paste ×{SCHEDULER_BULK}</button>
              <button type="button" className="os-btn os-btn-text os-btn-sm" onClick={clearAll}>Clear queue</button>
            </div>
          </div>
          {notice && <div className="os-sched-notice" role="alert"><AlertTriangle size={17} aria-hidden /><p>{notice}</p></div>}
          {queueQ.isPending ? <Skel h={280} className="rounded-4" /> : (
            <div className="os-sched-queue">
              {count === 0 ? (
                <div className="os-sched-empty"><Hourglass size={24} aria-hidden /><p>Queue is empty. Add one trade or bulk-paste twenty.</p></div>
              ) : (
                <>
                  <table className="os-queue-table">
                    <thead><tr><th>#</th><th>Symbol</th><th>Side</th><th>Lots</th><th>Fires at</th><th>Account</th></tr></thead>
                    <tbody>
                      {shown.map((it, i) => (
                        <tr key={it.id}>
                          <td className="os-mono">{String(i + 1).padStart(2, "0")}</td>
                          <td className="os-mono fw-semibold">{it.symbol}</td>
                          <td><span className={it.side === "BUY" ? "os-up fw-semibold" : "os-down fw-semibold"}>{it.side}</span></td>
                          <td className="os-mono">{it.lots}</td>
                          <td className="os-mono">{it.at}</td>
                          <td>{it.account}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {count > shown.length && <div className="os-queue-more os-mono">+ {count - shown.length} more in queue</div>}
                </>
              )}
            </div>
          )}
          <p className="os-sched-note"><CalendarClock size={15} aria-hidden /> Interactive demo with sample data. Scheduling in the dashboard writes real Records entries once the backend is connected.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── S6 · finance flow ───────────────── */

const LANE_ICONS: Record<string, LucideIcon> = { api: Zap, "deep-link": Link2, manual: FileCheck2 };

function FinanceFlow() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["finance-lanes"], queryFn: getFinanceLanes });
  return (
    <section className="os-section" aria-labelledby="os-finance-title">
      <div className="container">
        <SectionHead eyebrow="Finance flow" title={<span id="os-finance-title">Money moves three ways. The ledger never sleeps.</span>} lead="Deposits, withdrawals and transfers take whichever lane the broker's API allows. Where the API says no, proof and reconciliation keep your records complete." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-4 row-cols-1 row-cols-lg-3">{Array.from({ length: 3 }, (_, i) => <div className="col" key={i}><Skel h={420} className="rounded-4" /></div>)}</div> : (
          <div className="row g-4 row-cols-1 row-cols-lg-3">
            {data.map((lane, i) => {
              const Icon = LANE_ICONS[lane.id] ?? Zap;
              return (
                <div className="col" key={lane.id}>
                  <Reveal delay={i * 90} className="h-100">
                    <article className={`os-lane is-${lane.id}`}>
                      <div className="os-lane-head">
                        <span className="os-lane-icon"><Icon size={21} aria-hidden /></span>
                        <div><h3>{lane.name}</h3><span>{lane.when}</span></div>
                      </div>
                      <ol className="os-lane-steps">
                        {lane.steps.map((s, j) => (
                          <li key={s.title}><span className="os-mono">{j + 1}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>
                        ))}
                      </ol>
                      <div className="os-lane-examples">{lane.examples.map((e) => <span key={e}>{e}</span>)}</div>
                    </article>
                  </Reveal>
                </div>
              );
            })}
          </div>
        )}
        <Reveal className="os-ledger-rule"><Landmark size={24} aria-hidden /><div><strong>The ledger is always automated — even on the manual lane.</strong><p>Every movement, however it happens, ends as a reconciled Records entry with timestamp, amount and proof.</p></div></Reveal>
      </div>
    </section>
  );
}

/* ───────────────── S7 · guardrail lab ───────────────── */

function GuardLab() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["guard-scenarios"], queryFn: getGuardScenarios });
  const [activeId, setActiveId] = useState<string | null>(null);
  const scenario = data?.find((s) => s.id === activeId) ?? data?.[0];
  return (
    <section className="os-section os-band" aria-labelledby="os-guard-title">
      <div className="container">
        <SectionHead eyebrow="Guardrails in action" title={<span id="os-guard-title">Pick a signal. Watch the checks decide.</span>} lead="Four real situations, run against the same six checks that stand in front of every order." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending || !scenario ? <Skel h={380} className="rounded-4" /> : (
          <Reveal className="os-guard-lab">
            <div className="os-guard-scenarios" role="tablist" aria-label="Guardrail scenarios">
              {data.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={s.id === scenario.id} className={s.id === scenario.id ? "is-active" : ""} onClick={() => setActiveId(s.id)}>
                  <strong>{s.name}</strong>
                  <span className="os-mono">{s.order}</span>
                </button>
              ))}
            </div>
            <div className="os-guard-board" key={scenario.id}>
              <ul className="os-guard-checks">
                {scenario.checks.map((c, i) => (
                  <li className={c.pass ? "is-pass" : "is-fail"} style={{ animationDelay: `${i * 90}ms` }} key={c.label}>
                    <span className="os-guard-state">{c.pass ? <Check size={15} aria-label="Passed" /> : <X size={15} aria-label="Failed" />}</span>
                    <div><strong>{c.label}</strong>{c.note && <em>{c.note}</em>}</div>
                  </li>
                ))}
              </ul>
              <div className={`os-guard-verdict ${scenario.blocked ? "is-blocked" : "is-cleared"}`}>
                {scenario.blocked ? <XCircle size={22} aria-hidden /> : <CheckCircle2 size={22} aria-hidden />}
                <div>
                  <strong>{scenario.verdict}</strong>
                  <span className="os-mono">{scenario.record}</span>
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S8 · records lifecycle ───────────────── */

function RecordsLifecycle() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["record-states"], queryFn: getRecordStates });
  return (
    <section className="os-section" aria-labelledby="os-records-title">
      <div className="container">
        <SectionHead eyebrow="Records" title={<span id="os-records-title">A trade is a story. OStrade writes it down.</span>} lead="From submission to the journal, every state change is an event with the same reference — so any number traces back to the signal that started it." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <Skel h={230} className="rounded-4" /> : (
          <Reveal className="os-records-flow">
            <ol className="os-records-states">
              {data.map((s, i) => (
                <li key={s.id} style={{ ["--i" as string]: i }}>
                  <span className="os-record-dot" aria-hidden />
                  <h3>{s.label}</h3>
                  <span className="os-record-ref os-mono">{s.ref}</span>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ol>
            <div className="os-records-foot os-mono">One reference, five states, zero lost context</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S9 · disconnect handling ───────────────── */

function Disconnect() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["disconnect-sequence"], queryFn: getDisconnectSequence });
  return (
    <section className="os-section os-band" aria-labelledby="os-disconnect-title">
      <div className="container">
        <div className="row g-5 align-items-center">
          <div className="col-lg-5">
            <SectionHead center={false} eyebrow="When things break" title={<span id="os-disconnect-title">Disconnects pause. They never guess.</span>} lead="A lost connection is a state, not a catastrophe. OStrade degrades the account, pauses only what targets it, tells you why, and waits for your go-ahead." />
            <Reveal delay={80}><Link to="/brokers" className="os-btn os-btn-ghost os-btn-sm">See broker reliability notes <ArrowRight size={15} aria-hidden /></Link></Reveal>
          </div>
          <div className="col-lg-7">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-2">{Array.from({ length: 4 }, (_, i) => <div className="col" key={i}><Skel h={130} className="rounded-4" /></div>)}</div> : (
              <ol className="os-disconnect">
                {data.map((s, i) => (
                  <Reveal as="li" delay={i * 90} key={s.id} className={`os-dc-card is-${s.tone}`}>
                    <span className="os-dc-n os-mono">{i + 1}</span>
                    <span className="os-dc-dot" aria-hidden />
                    <h3>{s.label}</h3>
                    <p>{s.text}</p>
                  </Reveal>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S10 · FAQ ───────────────── */

function Faq() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["how-faqs"], queryFn: getHowFaqs });
  const [open, setOpen] = useState<string | null>("hf1");
  return (
    <section className="os-section" aria-labelledby="os-faq-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <SectionHead center={false} eyebrow="FAQ" title={<span id="os-faq-title">The mechanics, answered</span>} lead="Money safety, the MT5 bridge, schedule caps, disconnects, paper versus live, Telegram control, references and guardrails." />
            <Reveal delay={80} className="d-flex flex-wrap gap-2">
              <Link to="/brokers" className="os-btn os-btn-ghost os-btn-sm">Broker capabilities</Link>
              <a href="mailto:hello@ostrade.app" className="os-btn os-btn-text os-btn-sm">hello@ostrade.app</a>
            </Reveal>
          </div>
          <div className="col-lg-8">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={62} className="rounded-4" />)}</div> : (
              <div className="os-faq">
                {data.map((f) => {
                  const isOpen = open === f.id;
                  return (
                    <div className={`os-faq-item ${isOpen ? "is-open" : ""}`} key={f.id}>
                      <h3>
                        <button type="button" aria-expanded={isOpen} aria-controls={`hiw-panel-${f.id}`} id={`hiw-btn-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}>
                          <span>{f.q}</span>
                          <ChevronDown size={20} aria-hidden />
                        </button>
                      </h3>
                      <div className="os-faq-panel" id={`hiw-panel-${f.id}`} role="region" aria-labelledby={`hiw-btn-${f.id}`}>
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

/* ───────────────── S11 · CTA ───────────────── */

function FinalCta() {
  return (
    <section className="os-section os-cta-section" aria-labelledby="os-cta-title">
      <div className="container">
        <Reveal className="os-cta">
          <span className="os-cta-icon"><RadioTower size={26} aria-hidden /></span>
          <h2 id="os-cta-title">Your next signal deserves a pipeline.</h2>
          <p>Open a free paper account, paste a Telegram message, and watch it move through six stages into a journaled fill — in under a second.</p>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            <Link to="/auth/signup" className="os-btn os-btn-primary os-btn-lg">Start free on paper <ArrowRight size={18} aria-hidden /></Link>
            <Link to="/auth/broker-connect" className="os-btn os-btn-cta-ghost os-btn-lg">Connect a broker</Link>
          </div>
          <small><WalletCards size={14} aria-hidden /> Trading involves risk. Paper accounts use simulated money.</small>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── page ───────────────── */

export function HowItWorksPage() {
  usePageStyle("how-it-works", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "How It Works · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-how-it-works">
      <Hero />
      <Pipeline />
      <Anatomy />
      <Automation />
      <SchedulerLab />
      <FinanceFlow />
      <GuardLab />
      <RecordsLifecycle />
      <Disconnect />
      <Faq />
      <FinalCta />
    </main>
  );
}
