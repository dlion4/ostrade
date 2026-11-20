import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Globe,
  Info,
  Layers,
  Loader2,
  Network,
  Radio,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Wallet,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { BrokerBadge, EnvPill } from "@/components/DashboardShell";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  acknowledgeAlert,
  closePosition,
  createEventGuardSchedule,
  decideCopilotProposal,
  getAccounts,
  getAdapters,
  getAlerts,
  getCopilotProposals,
  getEconomicEvents,
  getEquityCurve,
  getPositions,
  getQuickSignalDrafts,
  getRecentRecords,
  getSchedulesSummary,
  getSessionClocks,
  getSignalRules,
  placeDashboardOrder,
  toggleScheduleItem,
  toggleSignalRule,
  updatePositionStops,
  type AdapterHealth,
  type DashboardMutationOutcome,
  type EquityPoint,
  type EquityRange,
  type JournalRecord,
  type OpenPosition,
  type TradingAccount,
} from "@/services/dashboard";
import css from "@/styles/pages/dash-command-center.css?inline";

/* ── Helpers ─────────────────────────────────────────────── */

function Skel({
  h = 18,
  w = "100%",
  className = "",
}: {
  h?: number;
  w?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`os-skel ${className}`}
      style={{ height: h, width: w }}
      aria-hidden
    />
  );
}

function fmtUsd(val: number, signed = false): string {
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `$${abs}`;
  return val >= 0 ? `+$${abs}` : `−$${abs}`;
}

function MiniSparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 88;
      const y = 26 - ((v - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="88"
      height="28"
      viewBox="0 0 88 28"
      className="os-mini-spark"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={positive ? "var(--os-up)" : "var(--os-down)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

/* ── S1 · Cockpit Header & Adapter Status Ribbon ─────────── */

function AdapterDrawer({
  adapter,
  onClose,
}: {
  adapter: AdapterHealth;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="os-cc-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="os-cc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="os-adp-drawer-title"
      >
        <div className="os-cc-drawer-head">
          <span className="os-cc-tag">ADAPTER SNAPSHOT</span>
          <button
            type="button"
            className="os-icon-btn"
            onClick={onClose}
            aria-label="Close adapter drawer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="os-cc-drawer-body">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
            <BrokerBadge broker={adapter.broker} label={adapter.name} />
            <span className={`os-adp-state is-${adapter.status}`}>
              <span className="os-adp-dot" />
              {adapter.status.toUpperCase()}
            </span>
          </div>
          <h2 id="os-adp-drawer-title" className="h4 mb-1">
            {adapter.name}
          </h2>
          <p className="small text-secondary mb-3">{adapter.protocol}</p>

          <div className="os-cc-kv-grid mb-3">
            <div>
              <span>Snapshot Latency</span>
              <strong className="os-mono">{adapter.latencyMs} ms</strong>
            </div>
            <div>
              <span>Last Snapshot Age</span>
              <strong className="os-mono">{adapter.snapshotAgeSec}s</strong>
            </div>
            <div>
              <span>Rate Headroom</span>
              <strong className="os-mono">{adapter.rateHeadroomPct}%</strong>
            </div>
            <div>
              <span>Linked Accounts</span>
              <strong className="os-mono">{adapter.linkedAccounts}</strong>
            </div>
          </div>

          <div className="os-cc-note-box mb-3">
            <Info size={16} aria-hidden />
            <span>{adapter.note}</span>
          </div>

          <h3 className="os-cc-sublabel">Supported Adapter Capabilities</h3>
          <div className="d-flex flex-wrap gap-2 mb-4">
            {adapter.capabilities.map((cap) => (
              <span key={cap} className="os-cc-cap-pill">
                <Check size={13} aria-hidden /> {cap}
              </span>
            ))}
          </div>

          <div className="d-grid gap-2">
            <Link
              to="/dashboard/accounts"
              className="os-btn os-btn-primary"
              onClick={onClose}
            >
              Open Accounts &amp; Broker Hub (T-9){" "}
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              to="/brokers"
              className="os-btn os-btn-ghost"
              onClick={onClose}
            >
              Public Capability Matrix
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusRibbonSection() {
  const { activeAccountId, setActiveAccountId, globalMode, killSwitch } =
    useDashboardContext();
  const adaptersQ = useQuery({ queryKey: ["adapters"], queryFn: getAdapters });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const [showStandby, setShowStandby] = useState(false);
  const [inspected, setInspected] = useState<AdapterHealth | null>(null);

  const activeAccount = (accountsQ.data ?? []).find(
    (a) => a.id === activeAccountId
  );
  const visibleAdapters = (adaptersQ.data ?? []).filter(
    (a) => showStandby || a.status !== "standby"
  );

  return (
    <section
      className="os-cc-section os-cc-header-section"
      aria-labelledby="os-cc-title"
    >
      <div className="os-cc-top-intro">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="os-cc-eyebrow">T-1 · TRADER COCKPIT</span>
            <span className="os-cc-static-pill">
              STATIC SNAPSHOT · NO LIVE TICKING
            </span>
          </div>
          <h1 id="os-cc-title" className="os-cc-h1">
            Command Center
          </h1>
          <p className="os-cc-sub mb-0">
            Viewing{" "}
            <strong>
              {activeAccount
                ? `${activeAccount.label} (${activeAccount.brokerName})`
                : "All 4 Connected Accounts"}
            </strong>
            {activeAccount && (
              <button
                type="button"
                className="os-cc-inline-link ms-2"
                onClick={() => setActiveAccountId("all")}
              >
                Reset to All Accounts
              </button>
            )}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/dashboard/signals"
            className="os-btn os-btn-primary os-btn-sm"
          >
            <ClipboardPaste size={15} aria-hidden /> Signal Desk (T-4)
          </Link>
          <Link
            to="/dashboard/trade"
            className="os-btn os-btn-ghost os-btn-sm"
          >
            <Send size={15} aria-hidden /> Trade Ticket (T-3)
          </Link>
          <Link
            to="/dashboard/accounts"
            className="os-btn os-btn-ghost os-btn-sm"
          >
            <Network size={15} aria-hidden /> Broker Hub (T-9)
          </Link>
        </div>
      </div>

      {/* Adapter Health Strip */}
      <div className="os-ribbon" role="region" aria-label="Adapter health ribbon">
        <div className="os-ribbon-chips">
          {adaptersQ.isError ? (
            <QueryError
              title="Could not load adapter health"
              onRetry={() => adaptersQ.refetch()}
            />
          ) : adaptersQ.isPending ? (
            Array.from({ length: 4 }, (_, i) => (
              <Skel key={i} h={42} w={195} />
            ))
          ) : (
            visibleAdapters.map((adp) => (
              <button
                key={adp.id}
                type="button"
                className={`os-adp-chip is-${adp.status}`}
                onClick={() => setInspected(adp)}
              >
                <span
                  className={
                    adp.status === "live"
                      ? "os-pulse"
                      : `os-adp-dot is-${adp.status}`
                  }
                  aria-hidden
                />
                <span className="fw-bold">{adp.name}</span>
                <span className="os-mono os-adp-metrics">
                  {adp.latencyMs}ms · {adp.snapshotAgeSec}s
                </span>
                <span
                  className="os-headroom"
                  title={`Rate-limit headroom ${adp.rateHeadroomPct}%`}
                >
                  <span style={{ width: `${adp.rateHeadroomPct}%` }} />
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            className="os-adp-more-btn"
            onClick={() => setShowStandby((v) => !v)}
          >
            {showStandby ? "Connected only (4)" : "+6 standby adapters"}
          </button>
        </div>

        <div className="os-ribbon-status">
          <span
            className={`os-global-badge ${globalMode === "paper" ? "is-paper" : "is-live"}`}
          >
            MODE: {globalMode.toUpperCase()}
          </span>
          <span className={`os-kill-state is-${killSwitch}`}>
            KILL SWITCH: {killSwitch.toUpperCase()}
          </span>
        </div>
      </div>

      {inspected && (
        <AdapterDrawer
          adapter={inspected}
          onClose={() => setInspected(null)}
        />
      )}
    </section>
  );
}

/* ── S2 · 6-Card Portfolio KPI Row ───────────────────────── */

function KpiRowSection() {
  const { activeAccountId, killSwitch } = useDashboardContext();
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const positionsQ = useQuery({
    queryKey: ["positions", { accountId: activeAccountId }],
    queryFn: () => getPositions({ accountId: activeAccountId }),
  });

  if (accountsQ.isError) {
    return (
      <section className="os-cc-section">
        <QueryError
          title="Could not load portfolio KPIs"
          onRetry={() => accountsQ.refetch()}
        />
      </section>
    );
  }

  const connected = (accountsQ.data ?? []).filter((a) => a.connected);
  const scoped =
    activeAccountId === "all"
      ? connected
      : connected.filter((a) => a.id === activeAccountId);

  const equity = scoped.reduce((s, a) => s + a.equity, 0);
  const realized = scoped.reduce((s, a) => s + a.realizedToday, 0);
  const floating = scoped.reduce((s, a) => s + a.floatingPnl, 0);
  const openCount = positionsQ.data?.length ?? 0;
  const worstMargin = scoped.reduce(
    (max, a) => (a.marginUsedPct > max ? a.marginUsedPct : max),
    0
  );
  const marginTone =
    worstMargin >= 85 ? "is-danger" : worstMargin >= 60 ? "is-warn" : "is-ok";

  const cards = [
    {
      id: "equity",
      label: "Aggregate Equity",
      numeric: Math.round(equity),
      formatted: fmtUsd(equity),
      sub:
        activeAccountId === "all"
          ? "Sum across 4 active accounts"
          : `${scoped[0]?.label ?? "Account"} · ${scoped[0]?.leverage ?? ""}`,
      tone: "neutral",
      icon: Wallet,
    },
    {
      id: "realized",
      label: "Today's Realized P&L",
      numeric: Math.round(Math.abs(realized)),
      formatted: fmtUsd(realized, true),
      sub: "14 closed fills logged in Records",
      tone: realized >= 0 ? "up" : "down",
      icon: TrendingUp,
    },
    {
      id: "floating",
      label: "Floating P&L Snapshot",
      numeric: Math.round(Math.abs(floating)),
      formatted: fmtUsd(floating, true),
      sub: "Static mark-to-snapshot across open trades",
      tone: floating >= 0 ? "up" : "down",
      icon: Activity,
    },
    {
      id: "positions",
      label: "Open Positions",
      numeric: openCount,
      formatted: String(openCount),
      sub:
        activeAccountId === "all"
          ? `Across ${connected.length} connected accounts`
          : `On ${scoped[0]?.label ?? "selected account"}`,
      tone: "neutral",
      icon: Layers,
    },
    {
      id: "margin",
      label: "Peak Margin Usage",
      numeric: Math.round(worstMargin),
      formatted: `${worstMargin.toFixed(1)}%`,
      sub:
        worstMargin >= 60
          ? "Exness MT5 Trial 1 (>60% soft alert)"
          : "Comfortable margin headroom",
      tone: worstMargin >= 85 ? "down" : worstMargin >= 60 ? "warn" : "up",
      icon: ShieldCheck,
      barPct: worstMargin,
      barTone: marginTone,
    },
    {
      id: "uptime",
      label: "Automation Uptime (24h)",
      numeric: 99,
      formatted: killSwitch === "armed" ? "99.8%" : "PAUSED",
      sub:
        killSwitch === "armed"
          ? "Rules & Scheduler engines healthy"
          : "Halted by operator kill-switch",
      tone: killSwitch === "armed" ? "up" : "warn",
      icon: Workflow,
    },
  ];

  return (
    <section className="os-cc-section" aria-label="Key portfolio metrics">
      <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-xl-3 row-cols-xxl-6">
        {accountsQ.isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <div className="col" key={i}>
                <Skel h={128} />
              </div>
            ))
          : cards.map((c, idx) => {
              const Icon = c.icon;
              return (
                <div className="col" key={c.id}>
                  <Reveal delay={idx * 50} className="h-100">
                    <article className={`os-kpi-card is-${c.tone}`}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="os-kpi-label">{c.label}</span>
                        <span className="os-kpi-icon">
                          <Icon size={16} aria-hidden />
                        </span>
                      </div>
                      <div className="os-kpi-value os-mono">
                        {c.id === "positions" ? (
                          <CountUp value={c.numeric} />
                        ) : (
                          c.formatted
                        )}
                      </div>
                      {c.barPct !== undefined && (
                        <div className={`os-kpi-bar ${c.barTone}`}>
                          <span style={{ width: `${Math.min(100, c.barPct)}%` }} />
                        </div>
                      )}
                      <div className="os-kpi-sub">{c.sub}</div>
                    </article>
                  </Reveal>
                </div>
              );
            })}
      </div>
    </section>
  );
}

/* ── S3 · Equity Curve + Per-Account Sparklines ──────────── */

function EquityCurveChart({
  points,
  mode,
  showDrawdown,
}: {
  points: EquityPoint[];
  mode: "total" | "realized";
  showDrawdown: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (points.length < 2) return null;

  const vals = points.map((p) => (mode === "total" ? p.equity : p.realizedOnly));
  const min = Math.min(...vals) * 0.996;
  const max = Math.max(...vals) * 1.004;
  const span = max - min || 1;
  const W = 720;
  const H = 240;
  const padX = 18;
  const padY = 20;

  const coords = points.map((pt, i) => {
    const v = mode === "total" ? pt.equity : pt.realizedOnly;
    const x = padX + (i / (points.length - 1)) * (W - padX * 2);
    const y = H - padY - ((v - min) / span) * (H - padY * 2);
    return { x, y, v, pt };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H - padY} L${coords[0].x.toFixed(1)},${H - padY} Z`;

  const inspected = coords[hoverIdx ?? coords.length - 1];

  return (
    <div className="os-chart-stage">
      <div className="os-chart-readout">
        <div>
          <span className="os-chart-readout-label">
            {inspected.pt.label} ·{" "}
            {mode === "total" ? "Realized + Floating" : "Realized Balance"}
          </span>
          <strong className="os-mono">{fmtUsd(inspected.v)}</strong>
        </div>
        <div className="text-end">
          <span className="os-chart-readout-label">Drawdown from peak</span>
          <strong className="os-mono os-down">
            {inspected.pt.drawdownPct.toFixed(2)}%
          </strong>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="os-equity-svg"
        role="img"
        aria-label="Portfolio equity curve"
      >
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={padX}
            x2={W - padX}
            y1={padY + r * (H - padY * 2)}
            y2={padY + r * (H - padY * 2)}
            stroke="var(--os-hairline)"
            strokeDasharray="4 4"
          />
        ))}

        {showDrawdown && (
          <path d={areaPath} fill="var(--os-brand-soft)" opacity="0.7" />
        )}

        <path
          d={linePath}
          fill="none"
          stroke="var(--os-brand)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="os-chart-stroke"
        />

        {coords.map((c, i) => (
          <g key={c.pt.label}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hoverIdx === i ? 6 : 4}
              fill={hoverIdx === i ? "var(--os-brand)" : "var(--os-surface-1)"}
              stroke="var(--os-brand)"
              strokeWidth="2.4"
            />
            <rect
              x={c.x - W / points.length / 2}
              y={0}
              width={W / points.length}
              height={H}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}
      </svg>

      <div className="os-chart-xlabels os-mono">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

function EquityAndAccountsSection() {
  const { activeAccountId, setActiveAccountId } = useDashboardContext();
  const toast = useToast();
  const [range, setRange] = useState<EquityRange>("1D");
  const [curveMode, setCurveMode] = useState<"total" | "realized">("total");
  const [showDrawdown, setShowDrawdown] = useState(true);
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  const curveQ = useQuery({
    queryKey: ["equity-curve", range, activeAccountId],
    queryFn: () => getEquityCurve(range, activeAccountId),
  });
  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const displayedAccounts = (accountsQ.data ?? []).filter(
    (a) => showAllAccounts || a.connected
  );

  return (
    <section className="os-cc-section" aria-labelledby="os-eq-heading">
      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="os-cc-card h-100">
            <div className="os-cc-card-head">
              <div>
                <h2 id="os-eq-heading" className="os-cc-h2">
                  Portfolio Equity Curve
                </h2>
                <p className="os-cc-card-sub">
                  Hover points to inspect balance vs drawdown across ranges
                </p>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="os-cc-tabs" role="tablist" aria-label="Chart range">
                  {(["1D", "1W", "1M", "3M", "ALL"] as EquityRange[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="tab"
                      aria-selected={range === r}
                      className={range === r ? "is-active" : ""}
                      onClick={() => setRange(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`os-cc-chip-toggle ${curveMode === "realized" ? "is-active" : ""}`}
                  onClick={() =>
                    setCurveMode((m) => (m === "total" ? "realized" : "total"))
                  }
                >
                  {curveMode === "total" ? "Total Equity" : "Realized Only"}
                </button>
                <button
                  type="button"
                  className={`os-cc-chip-toggle ${showDrawdown ? "is-active" : ""}`}
                  onClick={() => setShowDrawdown((v) => !v)}
                >
                  Area Shading
                </button>
              </div>
            </div>

            {curveQ.isError ? (
              <QueryError onRetry={() => curveQ.refetch()} />
            ) : curveQ.isPending ? (
              <Skel h={285} />
            ) : (
              <EquityCurveChart
                points={curveQ.data}
                mode={curveMode}
                showDrawdown={showDrawdown}
              />
            )}
          </div>
        </div>

        {/* Per-Account Sparkline List */}
        <div className="col-12 col-xl-4">
          <div className="os-cc-card h-100 d-flex flex-column">
            <div className="os-cc-card-head">
              <div>
                <h2 className="os-cc-h2">Account Sparklines</h2>
                <p className="os-cc-card-sub">
                  Click a connected account to filter cockpit
                </p>
              </div>
              <button
                type="button"
                className="os-cc-chip-toggle"
                onClick={() => setShowAllAccounts((v) => !v)}
              >
                {showAllAccounts ? "Connected (4)" : "All Slots (10)"}
              </button>
            </div>

            {accountsQ.isError ? (
              <QueryError onRetry={() => accountsQ.refetch()} />
            ) : accountsQ.isPending ? (
              <div className="d-grid gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skel key={i} h={62} />
                ))}
              </div>
            ) : (
              <div className="os-acct-spark-list">
                {displayedAccounts.map((acc: TradingAccount) => {
                  const isSelected = activeAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      className={`os-acct-spark-row ${isSelected ? "is-selected" : ""} ${!acc.connected ? "is-standby" : ""}`}
                      onClick={() => {
                        if (!acc.connected) {
                          toast(
                            `${acc.label} is in standby — link credentials in T-9`
                          );
                          return;
                        }
                        const next = isSelected ? "all" : acc.id;
                        setActiveAccountId(next);
                        toast(
                          next === "all"
                            ? "Context reset to All Connected Accounts"
                            : `Context focused on ${acc.label}`
                        );
                      }}
                    >
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <BrokerBadge
                            broker={acc.broker}
                            label={acc.brokerName}
                          />
                          <EnvPill env={acc.environment} />
                        </div>
                        <strong className="d-block text-truncate mt-1">
                          {acc.label}
                        </strong>
                        <small className="text-secondary">
                          {acc.accountNumber} · {acc.leverage}
                        </small>
                      </div>
                      <MiniSparkline
                        values={acc.sparkline}
                        positive={acc.todayChangePct >= 0}
                      />
                      <div className="text-end">
                        <div className="os-mono fw-bold" style={{ fontSize: "0.86rem" }}>
                          {fmtUsd(acc.equity)}
                        </div>
                        <div
                          className={`os-mono small fw-semibold ${acc.todayChangePct > 0 ? "os-up" : acc.todayChangePct < 0 ? "os-down" : "text-secondary"}`}
                        >
                          {acc.connected
                            ? `${acc.todayChangePct >= 0 ? "+" : ""}${acc.todayChangePct.toFixed(2)}%`
                            : "Standby"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
              <span className="small text-secondary">
                4 active · 6 standby presets
              </span>
              <Link to="/dashboard/accounts" className="os-cc-link">
                Account Hub (T-9) <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── S4 · Quick Signal-to-Order Pad (Paper Sim + Inert Live) */

function QuickSignalPadSection() {
  const { activeAccountId } = useDashboardContext();
  const qc = useQueryClient();
  const toast = useToast();

  const draftsQ = useQuery({
    queryKey: ["quick-signal-drafts"],
    queryFn: getQuickSignalDrafts,
  });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });

  const connected = (accountsQ.data ?? []).filter((a) => a.connected);

  const [selectedDraftId, setSelectedDraftId] = useState("qsd-01");
  const [rawSignal, setRawSignal] = useState(
    "XAUUSD BUY @ 2386.95 | SL 2379.00 | TP 2404.00"
  );
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [size, setSize] = useState("0.15");
  const [entry, setEntry] = useState("2386.95");
  const [sl, setSl] = useState("2379.00");
  const [tp, setTp] = useState("2404.00");
  const [targetAccId, setTargetAccId] = useState("acc-paper-main");
  const [outcome, setOutcome] = useState<DashboardMutationOutcome | null>(null);

  useEffect(() => {
    if (activeAccountId !== "all") {
      setTargetAccId(activeAccountId);
    }
  }, [activeAccountId]);

  const applyDraft = (id: string) => {
    setSelectedDraftId(id);
    const found = draftsQ.data?.find((d) => d.id === id);
    if (!found) return;
    setRawSignal(found.rawText);
    setSymbol(found.symbol);
    setSide(found.side);
    setSize(found.size);
    setEntry(found.entry);
    setSl(found.sl);
    setTp(found.tp);
    setOutcome(null);
  };

  const orderMut = useMutation({
    mutationFn: placeDashboardOrder,
    onSuccess: (res) => {
      setOutcome(res);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });

  const selectedAcc =
    connected.find((a) => a.id === targetAccId) ?? connected[0];
  const isPaperTarget = selectedAcc?.environment === "paper";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numSize = parseFloat(size);
    const numEntry = parseFloat(entry);
    const numSl = parseFloat(sl);
    const numTp = parseFloat(tp);
    if (!symbol.trim() || isNaN(numSize) || numSize <= 0 || isNaN(numEntry)) {
      toast("Enter a valid symbol, size, and entry price");
      return;
    }
    const draft = draftsQ.data?.find((d) => d.id === selectedDraftId);
    orderMut.mutate({
      accountId: targetAccId,
      symbol: symbol.trim(),
      side,
      size: numSize,
      entry: numEntry,
      sl: isNaN(numSl) ? 0 : numSl,
      tp: isNaN(numTp) ? 0 : numTp,
      origin: "Signal",
      channelNote: draft?.channel ?? "Quick Signal Pad",
    });
  };

  return (
    <section className="os-cc-section" aria-labelledby="os-pad-heading">
      <div className="os-cc-card">
        <div className="os-cc-card-head">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h2 id="os-pad-heading" className="os-cc-h2 mb-0">
                Quick Signal-to-Order Pad
              </h2>
              <span className="os-env-pill is-paper">
                PAPER SIMULATES LIVE · BROKERS INERT
              </span>
            </div>
            <p className="os-cc-card-sub">
              Pick a signal or paste text, override any field (manual edits
              always win), and test full local Paper fills → Positions &amp;
              Records
            </p>
          </div>
          <Link to="/dashboard/signals" className="os-cc-link">
            Full Signal Desk (T-4) <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        {/* 10 Signal Presets */}
        <div className="os-draft-strip mb-3" role="tablist" aria-label="Sample incoming signals">
          {(draftsQ.data ?? []).map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={selectedDraftId === d.id}
              className={`os-draft-pill ${selectedDraftId === d.id ? "is-active" : ""}`}
              onClick={() => applyDraft(d.id)}
            >
              <span className="os-mono fw-bold">{d.symbol}</span>
              <span className={d.side === "BUY" ? "os-up" : "os-down"}>
                {d.side === "BUY" ? "▲" : "▼"}
              </span>
              <small>{d.source}</small>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="row g-3 align-items-end">
          <div className="col-12 col-lg-4">
            <label htmlFor="cc-raw-signal" className="os-cc-label">
              Incoming Signal Text (Telegram / TradingView / Copy)
            </label>
            <textarea
              id="cc-raw-signal"
              rows={2}
              className="form-control os-mono os-cc-input"
              value={rawSignal}
              onChange={(e) => {
                setRawSignal(e.target.value);
                setOutcome(null);
              }}
            />
          </div>

          <div className="col-6 col-sm-3 col-lg-1">
            <label htmlFor="cc-sym" className="os-cc-label">
              Symbol
            </label>
            <input
              id="cc-sym"
              className="form-control os-mono os-cc-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>

          <div className="col-6 col-sm-3 col-lg-1">
            <label htmlFor="cc-side" className="os-cc-label">
              Side
            </label>
            <select
              id="cc-side"
              className="form-select os-mono os-cc-input"
              value={side}
              onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
            >
              <option value="BUY">BUY ▲</option>
              <option value="SELL">SELL ▼</option>
            </select>
          </div>

          <div className="col-4 col-sm-2 col-lg-1">
            <label htmlFor="cc-size" className="os-cc-label">
              Lots/Qty
            </label>
            <input
              id="cc-size"
              className="form-control os-mono os-cc-input"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>

          <div className="col-4 col-sm-2 col-lg-1">
            <label htmlFor="cc-entry" className="os-cc-label">
              Entry
            </label>
            <input
              id="cc-entry"
              className="form-control os-mono os-cc-input"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </div>

          <div className="col-4 col-sm-2 col-lg-1">
            <label htmlFor="cc-sl" className="os-cc-label">
              Stop Loss
            </label>
            <input
              id="cc-sl"
              className="form-control os-mono os-cc-input"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
            />
          </div>

          <div className="col-6 col-sm-4 col-lg-1">
            <label htmlFor="cc-tp" className="os-cc-label">
              Take Profit
            </label>
            <input
              id="cc-tp"
              className="form-control os-mono os-cc-input"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
            />
          </div>

          <div className="col-6 col-sm-8 col-lg-2">
            <label htmlFor="cc-target-acc" className="os-cc-label">
              Target Account
            </label>
            <select
              id="cc-target-acc"
              className="form-select os-cc-input"
              value={targetAccId}
              onChange={(e) => {
                setTargetAccId(e.target.value);
                setOutcome(null);
              }}
            >
              {connected.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.environment === "paper" ? "SIM" : "PREVIEW"})
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2 pt-1">
            <span className="small text-secondary">
              Guardrails active: mandatory SL check · max-lot check · duplicate
              shield
            </span>
            <button
              type="submit"
              className="os-btn os-btn-primary os-btn-sm"
              disabled={orderMut.isPending}
            >
              {orderMut.isPending ? (
                <>
                  <Loader2 size={15} className="os-spin" aria-hidden />{" "}
                  Routing order…
                </>
              ) : (
                <>
                  <Zap size={15} aria-hidden />{" "}
                  {isPaperTarget
                    ? `Place Simulated Trade on ${selectedAcc?.label ?? "Paper"}`
                    : `Stage Preview on ${selectedAcc?.label ?? "Broker"}`}
                </>
              )}
            </button>
          </div>
        </form>

        {outcome && (
          <div
            className={`os-outcome-banner mt-3 is-${outcome.mode}`}
            role="status"
          >
            {outcome.mode === "simulated" ? (
              <CheckCircle2 size={19} aria-hidden />
            ) : (
              <Info size={19} aria-hidden />
            )}
            <div className="flex-grow-1">
              <strong className="d-block">{outcome.title}</strong>
              <span className="small">{outcome.detail}</span>
            </div>
            <span className="os-mono os-outcome-badge">
              {outcome.mode === "simulated" ? "SIMULATED" : "BACKEND REQUIRED"}
            </span>
            <button
              type="button"
              className="os-icon-btn"
              onClick={() => setOutcome(null)}
              aria-label="Dismiss order notice"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S5 · Open Positions Snapshot (TanStack Table + Drawer) */

const posColHelper = createColumnHelper<OpenPosition>();

function PositionDetailDrawer({
  position,
  onClose,
}: {
  position: OpenPosition;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slVal, setSlVal] = useState(String(position.sl));
  const [tpVal, setTpVal] = useState(String(position.tp));
  const [feedback, setFeedback] = useState<DashboardMutationOutcome | null>(
    null
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const closeMut = useMutation({
    mutationFn: () => closePosition(position.id),
    onSuccess: (res) => {
      setFeedback(res);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
      if (res.mode === "simulated") {
        onClose();
      }
    },
  });

  const stopsMut = useMutation({
    mutationFn: () =>
      updatePositionStops(position.id, parseFloat(slVal), parseFloat(tpVal)),
    onSuccess: (res) => {
      setFeedback(res);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });

  return (
    <div
      className="os-cc-drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="os-cc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="os-pos-drawer-title"
      >
        <div className="os-cc-drawer-head">
          <span className="os-cc-tag os-mono">{position.ref}</span>
          <button
            type="button"
            className="os-icon-btn"
            onClick={onClose}
            aria-label="Close position drawer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="os-cc-drawer-body">
          <div className="d-flex align-items-center gap-2 mb-2">
            <BrokerBadge broker={position.broker} label={position.brokerName} />
            <EnvPill env={position.environment} />
            <span
              className={`os-side-pill ${position.side === "BUY" ? "is-buy" : "is-sell"}`}
            >
              {position.side} {position.side === "BUY" ? "▲" : "▼"}
            </span>
          </div>
          <h2 id="os-pos-drawer-title" className="h4 os-mono mb-1">
            {position.symbol}{" "}
            <small className="text-secondary fw-normal">
              ({position.brokerSymbol})
            </small>
          </h2>
          <p className="small text-secondary mb-3">
            {position.accountLabel} · Opened {position.openedAt} via{" "}
            {position.source}
          </p>

          <div className="os-cc-kv-grid mb-3">
            <div>
              <span>Position Size</span>
              <strong className="os-mono">
                {position.size} {position.sizeUnit}
              </strong>
            </div>
            <div>
              <span>Snapshot P&amp;L</span>
              <strong
                className={`os-mono ${position.pnl >= 0 ? "os-up" : "os-down"}`}
              >
                {fmtUsd(position.pnl, true)} ({position.pnlPct >= 0 ? "+" : ""}
                {position.pnlPct.toFixed(2)}%)
              </strong>
            </div>
            <div>
              <span>Entry Price</span>
              <strong className="os-mono">{position.entry}</strong>
            </div>
            <div>
              <span>Snapshot Price</span>
              <strong className="os-mono">{position.current}</strong>
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label htmlFor="pos-sl-edit" className="os-cc-label">
                Stop Loss
              </label>
              <input
                id="pos-sl-edit"
                className="form-control os-mono os-cc-input"
                value={slVal}
                disabled={position.broker === "deriv"}
                onChange={(e) => setSlVal(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label htmlFor="pos-tp-edit" className="os-cc-label">
                Take Profit
              </label>
              <input
                id="pos-tp-edit"
                className="form-control os-mono os-cc-input"
                value={tpVal}
                disabled={position.broker === "deriv"}
                onChange={(e) => setTpVal(e.target.value)}
              />
            </div>
          </div>

          {position.broker === "deriv" && (
            <div className="os-cc-note-box mb-3">
              <Info size={16} aria-hidden />
              <span>
                Deriv contracts do not support in-place MT-style SL/TP patching
                (§3.3 capability matrix).
              </span>
            </div>
          )}

          {feedback && (
            <div
              className={`os-outcome-banner mb-3 is-${feedback.mode}`}
              role="status"
            >
              <Info size={17} aria-hidden />
              <div>
                <strong className="d-block">{feedback.title}</strong>
                <span className="small">{feedback.detail}</span>
              </div>
            </div>
          )}

          <div className="d-grid gap-2">
            <button
              type="button"
              className="os-btn os-btn-ghost"
              disabled={stopsMut.isPending || position.broker === "deriv"}
              onClick={() => stopsMut.mutate()}
            >
              {stopsMut.isPending ? "Saving…" : "Save SL / TP Stops"}
            </button>
            <button
              type="button"
              className="os-btn os-btn-primary"
              disabled={closeMut.isPending}
              onClick={() => closeMut.mutate()}
            >
              {closeMut.isPending
                ? "Closing…"
                : position.environment === "paper"
                  ? `Close Simulated Position (${fmtUsd(position.pnl, true)})`
                  : "Stage Close (Backend Required)"}
            </button>
            <Link
              to="/dashboard/positions"
              className="os-btn os-btn-text"
              onClick={onClose}
            >
              Open Full Positions Screen (T-7) →
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PositionsSnapshotSection() {
  const { activeAccountId } = useDashboardContext();
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [search, setSearch] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedPos, setSelectedPos] = useState<OpenPosition | null>(null);

  const positionsQ = useQuery({
    queryKey: [
      "positions",
      { accountId: activeAccountId, side: sideFilter, search },
    ],
    queryFn: () =>
      getPositions({ accountId: activeAccountId, side: sideFilter, search }),
  });

  const rowsData = useMemo(() => {
    const all = positionsQ.data ?? [];
    return showAllRows ? all : all.slice(0, 8);
  }, [positionsQ.data, showAllRows]);

  const columns = useMemo(
    () => [
      posColHelper.accessor("accountLabel", {
        header: "Account",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="d-flex align-items-center gap-2">
              <BrokerBadge broker={row.broker} label={row.brokerName} />
              <span className="fw-medium">{row.accountLabel}</span>
            </div>
          );
        },
      }),
      posColHelper.accessor("symbol", {
        header: "Symbol",
        cell: (info) => (
          <div>
            <strong className="os-mono">{info.getValue()}</strong>
            <small className="d-block text-secondary os-mono">
              {info.row.original.ref}
            </small>
          </div>
        ),
      }),
      posColHelper.accessor("side", {
        header: "Side",
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={`os-side-pill ${v === "BUY" ? "is-buy" : "is-sell"}`}>
              {v} {v === "BUY" ? "▲" : "▼"}
            </span>
          );
        },
      }),
      posColHelper.accessor("size", {
        header: "Size",
        cell: (info) => (
          <span className="os-mono">
            {info.getValue()} {info.row.original.sizeUnit}
          </span>
        ),
      }),
      posColHelper.accessor("entry", {
        header: "Entry",
        cell: (info) => <span className="os-mono">{info.getValue()}</span>,
      }),
      posColHelper.accessor("current", {
        header: "Snapshot",
        cell: (info) => <span className="os-mono">{info.getValue()}</span>,
      }),
      posColHelper.display({
        id: "stops",
        header: "SL / TP",
        cell: (info) => (
          <span className="os-mono small text-secondary">
            {info.row.original.sl} / {info.row.original.tp}
          </span>
        ),
      }),
      posColHelper.accessor("pnl", {
        header: "Net P&L",
        cell: (info) => {
          const v = info.getValue();
          return (
            <span
              className={`os-mono fw-bold ${v >= 0 ? "os-up" : "os-down"}`}
            >
              {fmtUsd(v, true)}
            </span>
          );
        },
      }),
      posColHelper.display({
        id: "actions",
        header: "Action",
        cell: (info) => (
          <button
            type="button"
            className="os-manage-btn"
            onClick={() => setSelectedPos(info.row.original)}
          >
            Manage →
          </button>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: rowsData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totalMatches = positionsQ.data?.length ?? 0;

  return (
    <section className="os-cc-section" aria-labelledby="os-pos-heading">
      <div className="os-cc-card">
        <div className="os-cc-card-head">
          <div>
            <h2 id="os-pos-heading" className="os-cc-h2">
              Open Positions Snapshot
            </h2>
            <p className="os-cc-card-sub">
              Sorted by absolute P&amp;L impact · TanStack Table · click Manage
              to close or edit stops
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="os-cc-search">
              <Search size={15} aria-hidden />
              <label htmlFor="pos-search" className="visually-hidden">
                Search open positions
              </label>
              <input
                id="pos-search"
                placeholder="Symbol, account, ref…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="os-cc-tabs" role="group" aria-label="Filter side">
              {(["ALL", "BUY", "SELL"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={sideFilter === s ? "is-active" : ""}
                  onClick={() => setSideFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {totalMatches > 8 && (
              <button
                type="button"
                className="os-cc-chip-toggle"
                onClick={() => setShowAllRows((v) => !v)}
              >
                {showAllRows ? "Top 8" : `Show all (${totalMatches})`}
              </button>
            )}
          </div>
        </div>

        {positionsQ.isError ? (
          <QueryError onRetry={() => positionsQ.refetch()} />
        ) : positionsQ.isPending ? (
          <Skel h={310} />
        ) : rowsData.length === 0 ? (
          <div className="os-cc-empty">
            <SlidersHorizontal size={24} aria-hidden />
            <strong>No open positions match this filter</strong>
            <p className="small text-secondary mb-2">
              Clear the search or place a simulated Paper trade in the Quick
              Signal Pad above.
            </p>
            <button
              type="button"
              className="os-btn os-btn-ghost os-btn-sm"
              onClick={() => {
                setSearch("");
                setSideFilter("ALL");
              }}
            >
              Reset position filters
            </button>
          </div>
        ) : (
          <div className="os-cc-table-wrap">
            <table className="os-cc-table">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <th key={header.id} scope="col">
                          {canSort ? (
                            <button
                              type="button"
                              className="os-th-sort"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              <ArrowUpDown size={12} aria-hidden />
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        data-label={String(cell.column.columnDef.header ?? "")}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="os-cc-card-foot">
          <span className="small text-secondary">
            Showing {rowsData.length} of {totalMatches} open positions
          </span>
          <Link to="/dashboard/positions" className="os-cc-link">
            All positions &amp; pending orders (T-7){" "}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>

      {selectedPos && (
        <PositionDetailDrawer
          position={selectedPos}
          onClose={() => setSelectedPos(null)}
        />
      )}
    </section>
  );
}

/* ── S6 · Automation Board (Schedules · Rules · AI Co-Pilot) */

function AutomationBoardSection() {
  const qc = useQueryClient();
  const toast = useToast();

  const schedQ = useQuery({
    queryKey: ["schedules"],
    queryFn: getSchedulesSummary,
  });
  const rulesQ = useQuery({
    queryKey: ["signal-rules"],
    queryFn: getSignalRules,
  });
  const aiQ = useQuery({
    queryKey: ["copilot-proposals"],
    queryFn: getCopilotProposals,
  });

  const toggleSchedMut = useMutation({
    mutationFn: toggleScheduleItem,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast(res.active ? "Schedule slot armed" : "Schedule slot paused");
    },
  });

  const toggleRuleMut = useMutation({
    mutationFn: toggleSignalRule,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["signal-rules"] });
      toast(res.enabled ? "Signal rule enabled" : "Signal rule paused");
    },
  });

  const [aiNote, setAiNote] = useState<string | null>(null);
  const decideAiMut = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "dismissed";
    }) => decideCopilotProposal(id, decision),
    onSuccess: (res) => {
      setAiNote(`${res.title} — ${res.detail}`);
      qc.invalidateQueries({ queryKey: ["copilot-proposals"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });

  const usedSlots = schedQ.data?.usedSlots ?? 18;
  const maxSlots = schedQ.data?.maxSlots ?? 50;
  const slotPct = Math.round((usedSlots / maxSlots) * 100);
  const pendingProposals = (aiQ.data ?? []).filter(
    (p) => p.status === "pending"
  );
  const currentProposal = pendingProposals[0];

  return (
    <section className="os-cc-section" aria-labelledby="os-auto-board-heading">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h2 id="os-auto-board-heading" className="os-cc-h2 mb-0">
            Automation Command Board
          </h2>
          <p className="os-cc-card-sub mb-0">
            Scheduled slots, IF/THEN signal rules, and approval-gated AI
            co-pilot drafts
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Panel 1: Schedules */}
        <div className="col-12 col-lg-4">
          <div className="os-cc-card h-100 d-flex flex-column">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="os-panel-icon is-cyan">
                  <CalendarClock size={18} aria-hidden />
                </span>
                <strong>Trade Schedules</strong>
              </div>
              <span className="os-mono os-slot-pill">
                {usedSlots} / {maxSlots} slots
              </span>
            </div>

            <div
              className="os-slot-bar mb-3"
              role="progressbar"
              aria-valuenow={usedSlots}
              aria-valuemin={0}
              aria-valuemax={maxSlots}
              aria-label="Scheduled trade slots used"
            >
              <span style={{ width: `${slotPct}%` }} />
            </div>

            {schedQ.isError ? (
              <QueryError onRetry={() => schedQ.refetch()} />
            ) : schedQ.isPending ? (
              <Skel h={190} />
            ) : (
              <ul className="os-mini-list">
                {schedQ.data.items.slice(0, 4).map((s) => (
                  <li key={s.id} className={!s.active ? "is-muted" : ""}>
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <strong className="os-mono">{s.symbol}</strong>
                        <span
                          className={`os-side-pill ${s.side === "BUY" ? "is-buy" : s.side === "SELL" ? "is-sell" : "is-guard"}`}
                        >
                          {s.side}
                        </span>
                        <span className="os-mono small text-secondary">
                          {s.lots}
                        </span>
                      </div>
                      <small className="text-secondary">
                        {s.timeEat} ({s.countdown}) · {s.accountLabel}
                      </small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.active}
                      aria-label={`Toggle schedule ${s.symbol}`}
                      className={`os-switch-sm ${s.active ? "is-on" : ""}`}
                      onClick={() => toggleSchedMut.mutate(s.id)}
                    >
                      <span />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
              <span className="small text-secondary">Bulk paste ×20 ready</span>
              <Link to="/dashboard/scheduler" className="os-cc-link">
                Scheduler (T-6) <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {/* Panel 2: Signal Rules */}
        <div className="col-12 col-lg-4">
          <div className="os-cc-card h-100 d-flex flex-column">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <span className="os-panel-icon is-orange">
                  <Workflow size={18} aria-hidden />
                </span>
                <strong>Active Signal Rules</strong>
              </div>
              <span className="os-mono os-slot-pill">
                {(rulesQ.data ?? []).filter((r) => r.enabled).length} /{" "}
                {(rulesQ.data ?? []).length} active
              </span>
            </div>

            {rulesQ.isError ? (
              <QueryError onRetry={() => rulesQ.refetch()} />
            ) : rulesQ.isPending ? (
              <Skel h={190} />
            ) : (
              <ul className="os-mini-list">
                {rulesQ.data.slice(0, 4).map((r) => (
                  <li key={r.id} className={!r.enabled ? "is-muted" : ""}>
                    <div className="min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <strong className="text-truncate">{r.name}</strong>
                        <span
                          className={`os-decision-tag is-${r.lastDecision.toLowerCase()}`}
                        >
                          {r.lastDecision}
                        </span>
                      </div>
                      <small className="text-secondary d-block">
                        {r.source} · {r.firedToday} fired today · {r.lastReason}
                      </small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label={`Toggle rule ${r.name}`}
                      className={`os-switch-sm ${r.enabled ? "is-on" : ""}`}
                      onClick={() => toggleRuleMut.mutate(r.id)}
                    >
                      <span />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
              <span className="small text-secondary">10 rules configured</span>
              <Link to="/dashboard/automation" className="os-cc-link">
                Automation (T-5) <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {/* Panel 3: AI Co-Pilot Approval Gate */}
        <div className="col-12 col-lg-4">
          <div className="os-cc-card h-100 d-flex flex-column">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <span className="os-panel-icon is-violet">
                  <Bot size={18} aria-hidden />
                </span>
                <strong>AI Co-Pilot Gate</strong>
              </div>
              <span className="os-mono os-slot-pill">
                {pendingProposals.length} pending
              </span>
            </div>

            {aiQ.isError ? (
              <QueryError onRetry={() => aiQ.refetch()} />
            ) : aiQ.isPending ? (
              <Skel h={190} />
            ) : currentProposal ? (
              <div className="os-ai-box">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="os-ai-conf">
                    <Sparkles size={12} aria-hidden />{" "}
                    {currentProposal.confidence}
                  </span>
                  <EnvPill env={currentProposal.environment} />
                </div>
                <h3 className="os-ai-title">{currentProposal.title}</h3>
                <p className="os-ai-rationale">{currentProposal.rationale}</p>
                <div className="os-ai-action os-mono">
                  → {currentProposal.proposedAction}
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button
                    type="button"
                    className="os-btn os-btn-primary os-btn-sm flex-grow-1"
                    disabled={decideAiMut.isPending}
                    onClick={() =>
                      decideAiMut.mutate({
                        id: currentProposal.id,
                        decision: "approved",
                      })
                    }
                  >
                    <ThumbsUp size={14} aria-hidden /> Approve
                  </button>
                  <button
                    type="button"
                    className="os-btn os-btn-ghost os-btn-sm"
                    disabled={decideAiMut.isPending}
                    onClick={() =>
                      decideAiMut.mutate({
                        id: currentProposal.id,
                        decision: "dismissed",
                      })
                    }
                  >
                    <ThumbsDown size={14} aria-hidden /> Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="os-cc-empty py-4">
                <BadgeCheck size={22} aria-hidden />
                <strong>All 10 AI proposals reviewed</strong>
                <p className="small text-secondary mb-0">
                  Co-pilot never executes unattended.
                </p>
              </div>
            )}

            {aiNote && (
              <p className="small text-secondary mt-2 mb-0" role="status">
                {aiNote}
              </p>
            )}

            <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
              <span className="small text-secondary">Approval mandatory</span>
              <Link to="/dashboard/copilot" className="os-cc-link">
                AI Co-Pilot (T-13) <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── S7 · Alerts & Action Center ─────────────────────────── */

function AlertsCenterSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<"unread" | "critical" | "all">("unread");

  const alertsQ = useQuery({ queryKey: ["alerts"], queryFn: getAlerts });

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast("Alert acknowledged & logged");
    },
  });

  const allAlerts = alertsQ.data ?? [];
  const filtered = allAlerts.filter((a) => {
    if (filter === "unread") return !a.acknowledged;
    if (filter === "critical")
      return a.severity === "critical" || a.severity === "warning";
    return true;
  });

  return (
    <section className="os-cc-section" aria-labelledby="os-alerts-heading">
      <div className="os-cc-card">
        <div className="os-cc-card-head">
          <div>
            <h2 id="os-alerts-heading" className="os-cc-h2">
              Alerts &amp; Action Center
            </h2>
            <p className="os-cc-card-sub">
              Adapter reconnects, margin warnings, guardrail blocks, and ledger
              confirmations
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="os-cc-tabs" role="tablist" aria-label="Filter alerts">
              <button
                type="button"
                role="tab"
                aria-selected={filter === "unread"}
                className={filter === "unread" ? "is-active" : ""}
                onClick={() => setFilter("unread")}
              >
                Unacknowledged (
                {allAlerts.filter((a) => !a.acknowledged).length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "critical"}
                className={filter === "critical" ? "is-active" : ""}
                onClick={() => setFilter("critical")}
              >
                Critical &amp; Warn
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                className={filter === "all" ? "is-active" : ""}
                onClick={() => setFilter("all")}
              >
                All ({allAlerts.length})
              </button>
            </div>
            <Link to="/dashboard/notifications" className="os-cc-link ms-1">
              T-15 <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
        </div>

        {alertsQ.isError ? (
          <QueryError onRetry={() => alertsQ.refetch()} />
        ) : alertsQ.isPending ? (
          <Skel h={220} />
        ) : filtered.length === 0 ? (
          <div className="os-cc-empty">
            <BellRing size={22} aria-hidden />
            <strong>No unacknowledged alerts in this view</strong>
            <button
              type="button"
              className="os-btn os-btn-ghost os-btn-sm mt-2"
              onClick={() => setFilter("all")}
            >
              View all 10 alerts
            </button>
          </div>
        ) : (
          <div className="os-alert-stack">
            {filtered.map((a) => (
              <article
                key={a.id}
                className={`os-alert-row is-${a.severity} ${a.acknowledged ? "is-ack" : ""}`}
              >
                <span className="os-alert-indicator" aria-hidden>
                  {a.severity === "critical" && !a.acknowledged ? (
                    <span className="os-pulse os-pulse-danger" />
                  ) : a.severity === "warning" ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <Radio size={16} />
                  )}
                </span>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong>{a.title}</strong>
                    <span className="os-alert-meta os-mono">
                      {a.accountLabel} · {a.timestamp}
                    </span>
                  </div>
                  <p className="mb-0 small text-secondary mt-1">{a.detail}</p>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <Link
                    to={a.routeTo}
                    className="os-btn os-btn-ghost os-btn-sm"
                  >
                    {a.ctaLabel}
                  </Link>
                  {!a.acknowledged ? (
                    <button
                      type="button"
                      className="os-btn os-btn-text os-btn-sm"
                      onClick={() => ackMut.mutate(a.id)}
                    >
                      <Check size={14} aria-hidden /> Ack
                    </button>
                  ) : (
                    <span className="small text-secondary os-mono px-2">
                      ACKED
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S8 · Recent Execution & Ledger Records (TanStack Table) */

const recColHelper = createColumnHelper<JournalRecord>();

function RecentRecordsSection() {
  const { activeAccountId } = useDashboardContext();
  const recordsQ = useQuery({
    queryKey: ["records", activeAccountId],
    queryFn: () => getRecentRecords(activeAccountId),
  });

  const columns = useMemo(
    () => [
      recColHelper.accessor("ref", {
        header: "Ref",
        cell: (info) => (
          <span className="os-mono fw-semibold">{info.getValue()}</span>
        ),
      }),
      recColHelper.accessor("timeEat", {
        header: "EAT",
        cell: (info) => (
          <span className="os-mono text-secondary">{info.getValue()}</span>
        ),
      }),
      recColHelper.accessor("accountLabel", {
        header: "Account",
        cell: (info) => (
          <BrokerBadge
            broker={info.row.original.broker}
            label={info.getValue()}
          />
        ),
      }),
      recColHelper.accessor("origin", {
        header: "Origin",
        cell: (info) => (
          <span className="os-origin-chip">{info.getValue()}</span>
        ),
      }),
      recColHelper.accessor("symbol", {
        header: "Instrument",
        cell: (info) => (
          <span className="os-mono fw-bold">
            {info.getValue()}{" "}
            {info.row.original.side !== "—" ? info.row.original.side : ""}
          </span>
        ),
      }),
      recColHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <span
            className={`os-rec-status is-${info.getValue().toLowerCase()}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      recColHelper.accessor("summary", {
        header: "Execution / Ledger Note",
        cell: (info) => <span className="small">{info.getValue()}</span>,
      }),
      recColHelper.accessor("impact", {
        header: "Impact",
        cell: (info) => {
          const val = info.getValue();
          const cls = val.startsWith("+")
            ? "os-up fw-bold"
            : val.startsWith("−")
              ? "os-down fw-bold"
              : "text-secondary";
          return <span className={`os-mono ${cls}`}>{val}</span>;
        },
      }),
    ],
    []
  );

  const rows = useMemo(
    () => (recordsQ.data ?? []).slice(0, 10),
    [recordsQ.data]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="os-cc-section" aria-labelledby="os-rec-heading">
      <div className="os-cc-card">
        <div className="os-cc-card-head">
          <div>
            <h2 id="os-rec-heading" className="os-cc-h2">
              Recent Records &amp; Audit Trail
            </h2>
            <p className="os-cc-card-sub">
              Every manual, signal, scheduled, guard, and ledger event lands
              here immediately
            </p>
          </div>
          <Link to="/dashboard/records" className="os-cc-link">
            Full Journal &amp; Analytics (T-8){" "}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        {recordsQ.isError ? (
          <QueryError onRetry={() => recordsQ.refetch()} />
        ) : recordsQ.isPending ? (
          <Skel h={290} />
        ) : (
          <div className="os-cc-table-wrap">
            <table className="os-cc-table">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} scope="col">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id}>
                    {r.getVisibleCells().map((c) => (
                      <td
                        key={c.id}
                        data-label={String(c.column.columnDef.header ?? "")}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S9 · Market Session Clocks (EAT) + Economic Calendar ── */

function MarketClocksAndCalendarSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showAllEvents, setShowAllEvents] = useState(false);

  const clocksQ = useQuery({
    queryKey: ["session-clocks"],
    queryFn: getSessionClocks,
  });
  const eventsQ = useQuery({
    queryKey: ["economic-events"],
    queryFn: getEconomicEvents,
  });

  const guardMut = useMutation({
    mutationFn: (eventId: string) => createEventGuardSchedule(eventId, 15),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["economic-events"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });

  const shownEvents = (eventsQ.data ?? []).slice(0, showAllEvents ? 10 : 5);

  return (
    <section
      id="market-clocks"
      className="os-cc-section"
      aria-labelledby="os-clocks-heading"
    >
      <div className="row g-4">
        {/* Left: 4 Session Clocks */}
        <div className="col-12 col-xl-5">
          <div className="os-cc-card h-100">
            <div className="os-cc-card-head">
              <div>
                <h2 id="os-clocks-heading" className="os-cc-h2">
                  Market Session Clocks (EAT)
                </h2>
                <p className="os-cc-card-sub">
                  East Africa Time (UTC+3) · London–New York overlap active
                </p>
              </div>
              <span className="os-mono os-slot-pill">
                <Globe size={13} aria-hidden /> 16:40 EAT
              </span>
            </div>

            {clocksQ.isError ? (
              <QueryError onRetry={() => clocksQ.refetch()} />
            ) : clocksQ.isPending ? (
              <Skel h={260} />
            ) : (
              <div className="row g-3 row-cols-1 row-cols-sm-2">
                {clocksQ.data.map((clk) => (
                  <div className="col" key={clk.id}>
                    <div
                      className={`os-clock-card ${clk.isOpen ? "is-open" : "is-closed"}`}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <strong>{clk.city}</strong>
                        <span
                          className={`os-sess-state ${clk.isOpen ? "is-open" : ""}`}
                        >
                          {clk.isOpen && <span className="os-pulse" />}
                          {clk.isOpen ? "OPEN" : "CLOSED"}
                        </span>
                      </div>
                      <div className="os-mono fw-bold" style={{ fontSize: "1rem" }}>
                        {clk.localTimeSnapshot}
                      </div>
                      <div className="small text-secondary os-mono">
                        {clk.hoursEat}
                      </div>
                      <div className="os-clock-foot">
                        <span>{clk.transitionNote}</span>
                        <small>{clk.liquidityNote}</small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: High-Impact Economic Calendar */}
        <div className="col-12 col-xl-7">
          <div className="os-cc-card h-100 d-flex flex-column">
            <div className="os-cc-card-head">
              <div>
                <h2 className="os-cc-h2">High-Impact Economic Calendar</h2>
                <p className="os-cc-card-sub">
                  Queue a ±15m News Guard directly into your Scheduler (n / 50
                  slots)
                </p>
              </div>
              <button
                type="button"
                className="os-cc-chip-toggle"
                onClick={() => setShowAllEvents((v) => !v)}
              >
                {showAllEvents ? "Next 5 events" : "All 10 events"}
              </button>
            </div>

            {eventsQ.isError ? (
              <QueryError onRetry={() => eventsQ.refetch()} />
            ) : eventsQ.isPending ? (
              <Skel h={260} />
            ) : (
              <div className="os-econ-list">
                {shownEvents.map((ev) => (
                  <div key={ev.id} className="os-econ-row">
                    <div className="d-flex align-items-center gap-2">
                      <span className="os-ccy-pill os-mono">{ev.currency}</span>
                      <span
                        className="os-stars"
                        aria-label={`${ev.impact} star impact`}
                      >
                        {Array.from({ length: ev.impact }, (_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill="currentColor"
                            aria-hidden
                          />
                        ))}
                      </span>
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <strong className="d-block text-truncate">
                        {ev.title}
                      </strong>
                      <small className="text-secondary os-mono">
                        {ev.timeEat} ({ev.countdown}) · Fcst {ev.forecast} /
                        Prev {ev.previous}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`os-btn os-btn-sm ${ev.guardScheduled ? "os-btn-ghost" : "os-btn-dark"}`}
                      disabled={guardMut.isPending}
                      onClick={() => guardMut.mutate(ev.id)}
                    >
                      {ev.guardScheduled ? (
                        <>
                          <Check size={14} aria-hidden /> Guarded
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={14} aria-hidden /> Guard ±15m
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
              <span className="small text-secondary">
                <BookOpenCheck size={14} className="me-1" aria-hidden />
                Trading leveraged instruments around macro releases carries
                elevated slippage risk.
              </span>
              <Link to="/dashboard/scheduler" className="os-cc-link">
                T-6 Scheduler <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Page Root ───────────────────────────────────────────── */

export function DashCommandCenterPage() {
  usePageStyle("dash-command-center", css);

  useEffect(() => {
    const prev = document.title;
    document.title = "Command Center (T-1) · OStrade";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main className="page-dash-command-center">
      <StatusRibbonSection />
      <KpiRowSection />
      <EquityAndAccountsSection />
      <QuickSignalPadSection />
      <PositionsSnapshotSection />
      <AutomationBoardSection />
      <AlertsCenterSection />
      <RecentRecordsSection />
      <MarketClocksAndCalendarSection />
    </main>
  );
}
