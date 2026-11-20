import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
  CircleGauge,
  Clock3,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Radar,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Audit, Exposure } from "@/components/risk/RiskActivity";
import {
  Emergency,
  PolicyRules,
  Receipts,
} from "@/components/risk/RiskControls";
import { Btn, ErrorText, Tag, usd } from "@/components/risk/RiskUI";
import { Lab, Sessions, Shields } from "@/components/risk/RiskWorkspaces";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getRiskOverview } from "@/services/risk";
import css from "@/styles/pages/dash-risk.css?inline";

const sections = [
  ["overview", "Overview", "Risk overview", Layers3],
  ["emergency", "Kill switch", "Kill switch", ShieldAlert],
  ["rules", "Rules", "Guardrail rules", SlidersHorizontal],
  ["lab", "Pre-trade", "Pre-trade check engine", FlaskConical],
  ["shields", "Shields", "Fat-finger & storm guards", Radar],
  ["session", "Sessions", "Session limits & reality check", Clock3],
  ["exposure", "Exposure", "Account exposure", ChartNoAxesColumnIncreasing],
  ["receipts", "Receipts", "Emergency receipts", FileCheck2],
  ["audit", "Audit", "Risk audit log", Fingerprint],
] as const;
type SectionId = (typeof sections)[number][0];
type Overview = Awaited<ReturnType<typeof getRiskOverview>>;
function Section({
  id,
  copy,
  action,
  children,
}: {
  id: SectionId;
  copy: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [, , title, Icon] = sections.find((s) => s[0] === id)!;
  return (
    <section
      className="os-rk-section"
      id={`risk-${id}`}
      aria-labelledby={`risk-title-${id}`}
    >
      <div className="os-rk-section-head">
        <div>
          <span className="os-rk-icon os-rk-section-icon">
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`risk-title-${id}`}>{title}</h2>
            <p>{copy}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metrics({ m }: { m?: Overview }) {
  const used = m && m.lossLimit ? (Math.max(0, -m.pnl) / m.lossLimit) * 100 : 0;
  const cards = [
    {
      icon: Activity,
      label: "Daily P&L vs limit",
      value: m ? usd(m.pnl, 0) : "—",
      caption: m?.lossLimit
        ? `${usd(m.lossLimit, 0)} daily loss limit`
        : "Workspace realized",
      tone: "blue",
    },
    {
      icon: WalletCards,
      label: "Open risk",
      value: m ? usd(m.risk, 0) : "—",
      caption: m?.unprotected
        ? `${m.unprotected} unbounded · excluded`
        : "At protective stops",
      tone: "amber",
    },
    {
      icon: CircleGauge,
      label: "Min margin level",
      value: m && Number.isFinite(m.margin) ? `${m.margin.toFixed(1)}%` : "—",
      caption: "Lowest account in snapshot",
      tone: "green",
    },
    {
      icon: ShieldAlert,
      label: "Blocks today",
      value: m ? <CountUp value={m.blocks} duration={420} /> : "—",
      caption: "Local submissions · EAT",
      tone: "red",
    },
    {
      icon: ShieldCheck,
      label: "Kill-switch state",
      value: m ? m.state.toUpperCase() : "—",
      caption:
        m?.state === "armed"
          ? "Automation can evaluate"
          : "Review emergency controls",
      tone: m?.state === "armed" ? "green" : "red",
    },
  ];
  return (
    <div className="os-rk-metrics" aria-busy={!m}>
      {cards.map((c, i) => (
        <article className="os-rk-card os-rk-metric" key={c.label}>
          <span className={`os-rk-icon os-rk-${c.tone}`}>
            <c.icon size={17} />
          </span>
          <span>{c.label}</span>
          <strong className={i === 4 ? "os-rk-state-value" : ""}>
            {c.value}
          </strong>
          <small>{c.caption}</small>
          {i === 0 && (
            <div
              className="os-rk-ring"
              role="progressbar"
              aria-label="Daily loss limit used"
              aria-valuenow={Math.min(100, Math.round(used))}
              style={{
                background: `conic-gradient(var(--rk-orange) ${Math.min(100, used)}%, var(--rk-track) 0)`,
              }}
            >
              <span>{used.toFixed(0)}%</span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
export function DashRiskPage() {
  usePageStyle("dash-risk", css);
  const q = useQuery({
    queryKey: ["risk", "overview"],
    queryFn: getRiskOverview,
  });
  const { killSwitch } = useDashboardContext();
  const [active, setActive] = useState<SectionId>("overview");
  useEffect(() => {
    const previous = document.title;
    document.title = "Risk & Guardrails | OStrade";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    void q.refetch();
  }, [killSwitch, q.refetch]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visible = sections.filter(
          ([id]) =>
            (document.getElementById(`risk-${id}`)?.getBoundingClientRect()
              .top ?? Infinity) <= 146,
        );
        setActive(
          window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 10
            ? "audit"
            : (visible[visible.length - 1]?.[0] ?? "overview"),
        );
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  const jump = (id: SectionId) => {
    setActive(id);
    document
      .getElementById(`risk-${id}`)
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <main className="page-dash-risk" aria-labelledby="risk-heading">
      <header className="os-rk-hero">
        <div className="os-rk-hero-copy">
          <div className="os-rk-kicker">
            <span className="os-rk-icon os-rk-amber">
              <Shield size={17} />
            </span>{" "}
            RISK CONTROL CENTER
          </div>
          <h1 id="risk-heading">
            Risk &amp; Guardrails<span>.</span>
          </h1>
          <p>
            Set the limits before you trade. Inspect every decision and put
            automation on hold when you need to.
          </p>
          <div className="os-rk-actions">
            <Btn kind="primary" onClick={() => jump("emergency")}>
              <ShieldAlert size={17} /> Emergency controls
            </Btn>
            <Btn onClick={() => jump("lab")}>
              Test a ticket <ArrowUpRight size={15} />
            </Btn>
          </div>
        </div>
        <div className="os-rk-hero-art" aria-hidden="true">
          <div className="os-rk-orbit" />
          <div className="os-rk-orbit" />
          <div className="os-rk-orbit" />
          <div className="os-rk-shield-art">
            <ShieldCheck size={74} strokeWidth={1.4} />
          </div>
          <div className="os-rk-float os-rk-float-a">
            <LockKeyhole size={15} />
            <div>
              <strong>Protected controls</strong>
              <small>Demo 2FA required</small>
            </div>
          </div>
          <div className="os-rk-float os-rk-float-b">
            <Activity size={17} />
            <div>
              <strong>Fixed snapshots</strong>
              <small>No live broker dispatch</small>
            </div>
          </div>
        </div>
        <span className="os-rk-hero-index" aria-hidden="true">
          OS / RISK 14
        </span>
      </header>
      <nav className="os-rk-nav" aria-label="Risk sections">
        {sections.map(([id, label, , Icon]) => (
          <button
            key={id}
            aria-current={active === id ? "location" : undefined}
            onClick={() => jump(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      <Section
        id="overview"
        copy="Workspace-wide readings from the local account and position stores."
        action={
          <Tag tone="blue">
            <span className="os-rk-tag-dot" /> Local simulation · EAT
          </Tag>
        }
      >
        <Metrics m={q.data} />
        {q.isError && (
          <>
            <ErrorText error={q.error} />
            <Btn onClick={() => void q.refetch()}>Retry snapshot</Btn>
          </>
        )}
      </Section>
      <Section
        id="emergency"
        copy="Stop automated entries, flatten Paper exposure, or lock all new entries."
      >
        <Emergency view={q.data} onReport={() => jump("receipts")} />
      </Section>
      <Section
        id="rules"
        copy="Define hard thresholds for the workspace and stricter limits for individual accounts."
        action={
          <Tag tone="amber">
            <LockKeyhole size={12} /> Demo 2FA on edits
          </Tag>
        }
      >
        <PolicyRules view={q.data} />
      </Section>
      <Section
        id="lab"
        copy="Replay the same checks used by local submissions. The lab never places a trade."
      >
        <Lab />
      </Section>
      <Section
        id="shields"
        copy="Review duplicate, high-rate, stake-outlier and off-price decisions."
      >
        <Shields />
      </Section>
      <Section
        id="session"
        copy="Review time spent, loss streaks and the next EAT reset boundary."
      >
        <Sessions />
      </Section>
      <Section
        id="exposure"
        copy="Locate stop-risk concentration and positions without a modeled bound."
      >
        <Exposure
          rows={q.data?.exposure ?? []}
          pending={q.isPending}
          error={q.error}
        />
      </Section>
      <Section
        id="receipts"
        copy="See exactly what closed and which broker positions remain open."
      >
        <Receipts />
      </Section>
      <Section
        id="audit"
        copy="Inspect evidence, reasons and references from sample and local decisions."
      >
        <Audit />
      </Section>
      <footer className="os-rk-footer">
        <span>
          <Shield size={16} /> OStrade Risk · Local audit and fixed data
        </span>
        <button
          className="os-rk-link"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            })
          }
        >
          Back to top <ArrowDown size={14} className="os-rk-arrow-up" />
        </button>
      </footer>
    </main>
  );
}
