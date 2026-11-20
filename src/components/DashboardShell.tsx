import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  FlaskConical,
  Radio,
  Power,
  BookOpen,
  ArrowUpRight,
  ClipboardPaste,
  Clock,
  Compass,
  Hammer,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Send,
  Settings,
  ShieldAlert,
  Sun,
  UserCheck,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  DashboardProvider,
  useDashboardContext,
} from "@/context/DashboardContext";
import { useTheme } from "@/hooks/useTheme";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  applyKillSwitch,
  getAccounts,
  type BrokerKey,
  type EnvironmentKind,
  type KillSwitchMode,
} from "@/services/dashboard";
import { getNotificationOverview, notificationKey, notificationTime, subscribeNotifications, updateNotifications } from "@/services/notifications";
import { useToast } from "./Toast";
import stubCss from "@/styles/pages/stub.css?inline";

/* ── Shared Badges (§7) ──────────────────────────────────── */

export function BrokerBadge({
  broker,
  label,
}: {
  broker: BrokerKey;
  label: string;
}) {
  return <span className={`os-broker-badge is-${broker}`}>{label}</span>;
}

export function EnvPill({ env }: { env: EnvironmentKind }) {
  const text =
    env === "paper" ? "SIMULATED" : env === "demo" ? "DEMO" : "LIVE-READY";
  return <span className={`os-env-pill is-${env}`}>{text}</span>;
}

/* ── 16 Trader Dashboard Routes (§17) ────────────────────── */

export interface DashNavItem {
  code: string;
  label: string;
  to:
    | "/dashboard"
    | "/dashboard/markets"
    | "/dashboard/trade"
    | "/dashboard/signals"
    | "/dashboard/automation"
    | "/dashboard/scheduler"
    | "/dashboard/positions"
    | "/dashboard/records"
    | "/dashboard/accounts"
    | "/dashboard/deposits"
    | "/dashboard/withdrawals"
    | "/dashboard/transfers"
    | "/dashboard/copilot"
    | "/dashboard/risk"
    | "/dashboard/notifications"
    | "/dashboard/settings";
  icon: LucideIcon;
}

export const DASH_NAV_GROUPS: { group: string; items: DashNavItem[] }[] = [
  {
    group: "Cockpit & Markets",
    items: [
      { code: "T-1", label: "Command Center", to: "/dashboard", icon: LayoutDashboard },
      { code: "T-2", label: "Markets", to: "/dashboard/markets", icon: Compass },
      { code: "T-3", label: "Trade Ticket", to: "/dashboard/trade", icon: Send },
      { code: "T-4", label: "Signal Desk", to: "/dashboard/signals", icon: ClipboardPaste },
    ],
  },
  {
    group: "Automation & Positions",
    items: [
      { code: "T-5", label: "Automation", to: "/dashboard/automation", icon: Workflow },
      { code: "T-6", label: "Trade Scheduler", to: "/dashboard/scheduler", icon: CalendarClock },
      { code: "T-7", label: "Positions & Orders", to: "/dashboard/positions", icon: Layers },
      { code: "T-8", label: "Records & Analytics", to: "/dashboard/records", icon: BarChart3 },
    ],
  },
  {
    group: "Accounts & Finance",
    items: [
      { code: "T-9", label: "Accounts & Broker Hub", to: "/dashboard/accounts", icon: Network },
      { code: "T-10", label: "Deposits", to: "/dashboard/deposits", icon: ArrowDownToLine },
      { code: "T-11", label: "Withdrawals", to: "/dashboard/withdrawals", icon: ArrowUpFromLine },
      { code: "T-12", label: "Transfers & Ledger", to: "/dashboard/transfers", icon: ArrowLeftRight },
    ],
  },
  {
    group: "Intelligence & Guardrails",
    items: [
      { code: "T-13", label: "AI Co-Pilot", to: "/dashboard/copilot", icon: Bot },
      { code: "T-14", label: "Risk & Guardrails", to: "/dashboard/risk", icon: ShieldAlert },
      { code: "T-15", label: "Notifications", to: "/dashboard/notifications", icon: Bell },
      { code: "T-16", label: "Settings", to: "/dashboard/settings", icon: Settings },
    ],
  },
];

/* ── Kill-Switch Confirmation Modal ──────────────────────── */

function KillSwitchModal({ onClose }: { onClose: () => void }) {
  const { killSwitch } = useDashboardContext();
  const [choice, setChoice] = useState<KillSwitchMode>(
    killSwitch === "armed" ? "paused" : "armed"
  );
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mut = useMutation({
    mutationFn: (mode:KillSwitchMode) => applyKillSwitch(mode),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["signal-rules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
      onClose();
    },
  });

  const options: {
    mode: KillSwitchMode;
    title: string;
    desc: string;
  }[] = [
    {
      mode: "paused",
      title: "Pause All Automation",
      desc: "Immediately pauses all Signal Rules and Scheduled slots. Open positions stay open.",
    },
    {
      mode: "flattened",
      title: "Pause + Flatten Paper Positions",
      desc: "Halts automation and closes all simulated Paper positions locally (logged to Records). Broker positions remain inert until backend connection.",
    },
    {
      mode: "armed",
      title: "Return to Armed Standby",
      desc: "Restores active rules and scheduled execution slots to normal guardrail supervision.",
    },
  ];

  return (
    <div
      className="os-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="os-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="os-kill-modal-title"
      >
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <AlertOctagon size={22} className="os-down" aria-hidden />
            <h2 id="os-kill-modal-title" className="h5 mb-0">
              Global Kill Switch
            </h2>
          </div>
          <button
            type="button"
            className="os-icon-btn"
            onClick={onClose}
            aria-label="Close kill switch dialog"
          >
            <X size={18} />
          </button>
        </div>
        <p className="small text-secondary mb-3">
          Current state:{" "}
          <strong className="os-mono text-uppercase">{killSwitch}</strong>.
          Choose an operator action below — every state change is recorded in
          the journal.
        </p>
        <div className="d-grid gap-2 mb-4">
          {options.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              className={`os-kill-option ${choice === opt.mode ? "is-selected" : ""}`}
              onClick={() => setChoice(opt.mode)}
            >
              <span
                className="os-mono fw-bold mt-1"
                style={{ fontSize: "0.75rem" }}
              >
                {choice === opt.mode ? "●" : "○"}
              </span>
              <div>
                <strong className="d-block" style={{ fontSize: "0.92rem" }}>
                  {opt.title}
                </strong>
                <span className="small text-secondary">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="os-btn os-btn-ghost os-btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="os-btn os-btn-primary os-btn-sm"
            disabled={mut.isPending}
            onClick={() => mut.mutate(choice)}
          >
            {mut.isPending ? "Applying…" : "Confirm Action"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar Navigation Contents ─────────────────────────── */

function SidebarContent({ onNavigate, desk = false }: { onNavigate?: () => void; desk?: boolean }) {
  const { globalMode, killSwitch } = useDashboardContext();
  return (
    <>
      {DASH_NAV_GROUPS.map((grp, idx) => (
        <div key={grp.group} className="mb-2">
          <div className="os-nav-group-label">{desk ? ["Workspace", "Trading tools", "Accounts & finance", "System"][idx] : grp.group}</div>
          <nav aria-label={grp.group}>
            {grp.items.map((item) => {
              const Icon = desk && item.code === "T-4" ? Radio : item.icon;
              return (
                <Link
                  key={item.code}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/dashboard" }}
                  activeProps={{ className: "os-side-link active" }}
                  inactiveProps={{ className: "os-side-link" }}
                  onClick={onNavigate}
                >
                  <Icon size={17} aria-hidden />
                  <span>{desk ? ({"T-5":"Automation engine", "T-6":"Scheduler", "T-8":"Records & journal", "T-9":"Broker hub", "T-12":"Transfers & ledger", "T-14":"Risk & guardrails"}[item.code] || item.label) : item.label}</span>
                  <span className="os-side-code">{item.code}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
      {desk ? <div className="os-desk-rail-foot"><div className="os-desk-local"><i /><span>Local engine ready</span></div><Link to="/how-it-works" onClick={onNavigate}><BookOpen size={15} /> Help & documentation <ArrowUpRight size={13} /></Link></div> : <div className="os-sidebar-foot mt-3">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="fw-semibold" style={{ fontSize: "0.78rem" }}>
            Frontend Preview
          </span>
          <span className="os-mono" style={{ fontSize: "0.68rem" }}>
            {globalMode.toUpperCase()} · {killSwitch.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: "0.73rem", lineHeight: 1.45 }}>
          Paper fills simulate locally; live broker rails stay safely inert.
        </div>
        <Link
          to="/"
          className="d-inline-flex align-items-center gap-1 mt-2 fw-semibold text-decoration-none"
          style={{ fontSize: "0.76rem" }}
          onClick={onNavigate}
        >
          <ArrowLeft size={13} aria-hidden /> Public Home
        </Link>
      </div>}
    </>
  );
}

/* ── Top Bar + Layout Inner ──────────────────────────────── */

function DashboardShellInner() {
  const deskPage = useRouterState({
    select: (s) => {
      const path = s.location.pathname.replace(/\/$/, "");
      return path === "/dashboard/signals" ? "signals" : path === "/dashboard/automation" ? "automation" : path === "/dashboard/records" ? "records" : path === "/dashboard/accounts" ? "accounts" : path === "/dashboard/deposits" ? "deposits" : path === "/dashboard/withdrawals" ? "withdrawals" : path === "/dashboard/transfers" ? "transfers" : path === "/dashboard/copilot" ? "copilot" : path === "/dashboard/risk" ? "risk" : path === "/dashboard/notifications" ? "notifications" : path === "/dashboard/settings" ? "settings" : null;
    },
  });
  const desk = deskPage !== null;
  const deskTitle = deskPage === "automation" ? "Automation" : deskPage === "records" ? "Records & Analytics" : deskPage === "accounts" ? "Accounts & Broker Hub" : deskPage === "deposits" ? "Deposits" : deskPage === "withdrawals" ? "Withdrawals" : deskPage === "transfers" ? "Transfers & Ledger" : deskPage === "copilot" ? "AI Co-Pilot" : deskPage === "risk" ? "Risk & Guardrails" : deskPage === "notifications" ? "Notifications & Alerts" : deskPage === "settings" ? "Workspace Settings" : "Signal Desk";
  const {
    activeAccountId,
    setActiveAccountId,
    setFanoutAccountIds,
    globalMode,
    setGlobalMode,
    killSwitch,
  } = useDashboardContext();
  const { theme, toggle: toggleTheme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [killModalOpen, setKillModalOpen] = useState(false);

  const acctRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });
  const alertsQ = useQuery({
    queryKey: [...notificationKey, "overview"],
    queryFn: getNotificationOverview,
  });

  useEffect(()=>subscribeNotifications(()=>{
    void qc.invalidateQueries({queryKey:notificationKey});
    void qc.invalidateQueries({queryKey:["alerts"]});
  }),[qc]);
  const ackAllMut = useMutation({
    mutationFn: () => updateNotifications({action:"read-all"}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: notificationKey });
      toast(
        res.count > 0
          ? `Acknowledged ${res.count} alerts`
          : "All alerts already acknowledged"
      );
    },
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (acctRef.current && !acctRef.current.contains(t)) setAcctMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(t)) setNotifMenuOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
      setAcctMenuOpen(false);
      setNotifMenuOpen(false);
      setProfileMenuOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const connectedAccounts = (accountsQ.data ?? []).filter((a) => a.connected);
  const totalEquity = connectedAccounts.reduce((s, a) => s + a.equity, 0);
  const activeAccount = connectedAccounts.find((a) => a.id === activeAccountId);
  const unreadAlerts = alertsQ.data?.recent ?? [];
  const unreadCount = alertsQ.data?.unread ?? 0;

  return (
    <div className={`os-dash-shell${desk ? ` os-desk-shell${deskPage === "records" ? " os-desk-records" : deskPage === "accounts" ? " os-desk-accounts" : deskPage === "deposits" ? " os-desk-deposits" : deskPage === "withdrawals" ? " os-desk-withdrawals" : deskPage === "transfers" ? " os-desk-transfers" : deskPage === "copilot" ? " os-desk-copilot" : deskPage === "risk" ? " os-desk-risk" : deskPage === "notifications" ? " os-desk-notifications" : deskPage === "settings" ? " os-desk-settings" : ` page-dash-signal-${deskPage}`}` : ""}`}>
      <a
        href="#dash-main"
        className="visually-hidden-focusable os-skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("dash-main")?.focus();
        }}
      >
        Skip to cockpit
      </a>

      {/* Sticky Top Bar */}
      <header className="os-dash-topbar">
        <div className="os-dash-brand-wrap">
          <button
            type="button"
            className="os-icon-btn os-dash-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open dashboard navigation"
          >
            <Menu size={18} />
          </button>
          <Link to="/dashboard" className="os-logo" aria-label="OStrade Command Center">
            <span className="os-logo-mark" aria-hidden>
              {desk ? <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="m2 16 5-10h4L6 16zM8 19l8-16h4l-8 16zM15 19l5-10h4l-5 10z" /></svg> : <Zap size={18} strokeWidth={2.4} />}
            </span>
            OStrade
          </Link>
          {!desk && <span className="os-dash-cockpit-tag">COCKPIT</span>}
        </div>

        {desk && <div className="os-desk-crumb"><PanelLeft size={16} /><Link to="/dashboard">Workspace</Link><ChevronRight size={12} /><strong>{deskTitle}</strong></div>}

        {/* Global Account Context Switcher */}
        <div className="os-acct-switcher-wrap" ref={acctRef}>
          <button
            type="button"
            className="os-acct-switcher-btn"
            aria-label={`Account context: ${activeAccount?.label ?? "All accounts"}`}
            aria-expanded={acctMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setAcctMenuOpen((v) => !v)}
          >
            {desk && <Layers size={14} aria-hidden />}
            <span>
              {activeAccount
                ? activeAccount.label
                : desk ? "All accounts" : `All Accounts (${connectedAccounts.length || 4})`}
            </span>
            <span className="os-acct-switcher-meta">
              $
              {(activeAccount ? activeAccount.equity : totalEquity).toLocaleString(
                "en-US",
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}
            </span>
            <ChevronDown size={15} aria-hidden />
          </button>

          {acctMenuOpen && (
            <div className="os-pop-menu" role="listbox" aria-label="Active trading account">
              <div className="os-pop-head">
                <span>Global Account Context</span>
                <span>USD Equity</span>
              </div>
              <button
                type="button"
                className={`os-acct-option ${activeAccountId === "all" ? "is-active" : ""}`}
                onClick={() => {
                  setActiveAccountId("all");
                  setFanoutAccountIds([]);
                  setAcctMenuOpen(false);
                  toast("Switched context: All Connected Accounts");
                }}
              >
                <div>
                  <strong>{deskPage === "accounts" ? "All Account Workspaces" : "All Connected Accounts"} ({connectedAccounts.length})</strong>
                  <small>Consolidated portfolio &amp; positions</small>
                </div>
                <span className="os-mono fw-bold" style={{ fontSize: "0.84rem" }}>
                  ${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </button>
              {connectedAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className={`os-acct-option ${activeAccountId === acc.id ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveAccountId(acc.id);
                    setFanoutAccountIds([]);
                    setAcctMenuOpen(false);
                    toast(`Active account: ${acc.label} (${acc.currency} ${acc.equity.toFixed(2)})`);
                  }}
                >
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <strong>{acc.label}</strong>
                      <EnvPill env={acc.environment} />
                    </div>
                    <small>
                      {acc.brokerName} · {acc.leverage} · {acc.accountNumber}
                    </small>
                  </div>
                  <span className="os-mono fw-semibold" style={{ fontSize: "0.83rem" }}>
                    ${acc.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>
              ))}
              <div className="pt-2 mt-1 border-top d-flex justify-content-between align-items-center px-1">
                <span className="small text-secondary" style={{ fontSize: "0.74rem" }}>
                  10 configured slots
                </span>
                <Link
                  to="/dashboard/accounts"
                  className="small fw-semibold text-decoration-none"
                  onClick={() => setAcctMenuOpen(false)}
                >
                  Manage in T-9 →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Global PAPER / LIVE Mode Toggle */}
        {!desk && <div className="os-mode-seg" role="group" aria-label="Global execution mode">
          <button
            type="button"
            className={globalMode === "paper" ? "is-paper-active" : ""}
            onClick={() => {
              setGlobalMode("paper");
              toast("Global mode: PAPER (simulated fills enabled)");
            }}
          >
            PAPER
          </button>
          <button
            type="button"
            className={globalMode === "live" ? "is-live-active" : ""}
            onClick={() => {
              setGlobalMode("live");
              toast("Global mode: LIVE PREVIEW (broker APIs inert until backend connects)");
            }}
          >
            LIVE
          </button>
        </div>}

        {/* Right Controls */}
        <div className="os-dash-top-right">
          {desk ? <button className="os-desk-mode" type="button" title="Switch workspace mode" onClick={() => {
              if (deskPage === "accounts") { document.getElementById("hub-context")?.scrollIntoView(); document.getElementById("hub-routing-mode")?.focus({ preventScroll: true }); return; }
              const next = globalMode === "paper" ? "live" : "paper";
              setGlobalMode(next);
              toast(next === "live" ? "Live preview: broker execution stays offline" : "Paper mode: local fills enabled");
            }}><FlaskConical size={13} />{globalMode === "paper" ? "Paper mode" : "Live preview"}</button> : <a
            href="#market-clocks"
            className="os-clock-chip"
            onClick={(e) => {
              const el = document.getElementById("market-clocks");
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            <Clock size={14} aria-hidden />
            <span className="os-mono">LDN · NY OPEN · 16:40 EAT</span>
          </a>}

          {/* Notifications Bell */}
          <div className="position-relative" ref={notifRef}>
            <button
              type="button"
              className="os-icon-btn os-notif-btn"
              aria-label={`Notifications (${unreadCount} unacknowledged)`}
              aria-expanded={notifMenuOpen}
              onClick={() => setNotifMenuOpen((v) => !v)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="os-notif-count">{unreadCount}</span>
              )}
            </button>
            {notifMenuOpen && (
              <div className="os-pop-menu is-right" role="region" aria-label="Recent alerts">
                <div className="os-pop-head">
                  <span>Alerts ({unreadCount} unread)</span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    style={{ fontSize: "0.72rem" }}
                    onClick={() => ackAllMut.mutate()}
                  >
                    <Check size={12} /> Ack all
                  </button>
                </div>
                {unreadCount === 0 ? (
                  <p className="small text-secondary mb-2 px-2 py-2">
                    No unread notifications.
                  </p>
                ) : (
                  unreadAlerts.slice(0, 4).map((a) => (
                    <Link
                      key={a.id}
                      to={`/dashboard/${a.destination}`}
                      className="os-acct-option text-decoration-none"
                      onClick={() => setNotifMenuOpen(false)}
                    >
                      <div>
                        <strong>{a.title}</strong>
                        <small>
                          {a.accountLabel} · {notificationTime(a.createdAt)} EAT
                        </small>
                      </div>
                    </Link>
                  ))
                )}
                <div className="pt-2 mt-1 border-top text-end px-1">
                  <Link
                    to="/dashboard/notifications"
                    className="small fw-semibold text-decoration-none"
                    onClick={() => setNotifMenuOpen(false)}
                  >
                    Open notification center →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Kill Switch */}
          <button
            type="button"
            className={`os-kill-btn ${killSwitch !== "armed" ? "is-engaged" : ""}`}
            aria-label="Open kill switch"
            onClick={() => setKillModalOpen(true)}
          >
            {desk ? <Power size={13} /> : <AlertOctagon size={15} aria-hidden />}
            <span className="os-kill-label-text">
              {killSwitch === "armed"
                ? desk ? "Kill switch" : "KILL SWITCH"
                : killSwitch === "paused"
                  ? "PAUSED"
                  : "FLATTENED"}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            className="os-icon-btn os-shell-theme"
            onClick={() => {
              toggleTheme();
              toast(theme === "light" ? "Dark theme enabled" : "Light theme enabled");
            }}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          {/* Operator Profile */}
          <div className="position-relative" ref={profileRef}>
            <button
              type="button"
              className="os-icon-btn"
              aria-label="Operator profile menu"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((v) => !v)}
            >
              {desk ? <span className="os-desk-avatar">AK</span> : <UserCheck size={17} />}
            </button>
            {profileMenuOpen && (
              <div className="os-pop-menu is-right" style={{ width: 250 }}>
                <div className="os-pop-head">
                  <span>Master Admin</span>
                  <span>EAT · UTC+3</span>
                </div>
                <Link
                  to="/dashboard/accounts"
                  className="os-acct-option text-decoration-none"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <div>
                    <strong>Accounts &amp; Brokers</strong>
                    <small>T-9 · Switcher &amp; vault</small>
                  </div>
                </Link>
                <Link
                  to="/dashboard/records"
                  className="os-acct-option text-decoration-none"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <div>
                    <strong>Records Journal</strong>
                    <small>T-8 · Full audit trail</small>
                  </div>
                </Link>
                <Link
                  to="/dashboard/settings"
                  className="os-acct-option text-decoration-none"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <div>
                    <strong>Workspace Settings</strong>
                    <small>T-16 · Master config</small>
                  </div>
                </Link>
                <div className="pt-2 mt-1 border-top d-flex justify-content-between px-2">
                  <Link
                    to="/"
                    className="small text-decoration-none"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Public site
                  </Link>
                  <Link
                    to="/auth/signin"
                    className="small fw-semibold text-decoration-none"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Sign out
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar + Main Content */}
      <div className="os-dash-body">
        <aside className="os-dash-sidebar" aria-label="Trader dashboard navigation">
          <SidebarContent desk={desk} />
        </aside>

        {mobileNavOpen && (
          <div
            className="os-dash-offcanvas-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMobileNavOpen(false);
            }}
          >
            <aside
              className="os-dash-sidebar-mobile"
              aria-label="Mobile dashboard navigation"
            >
              <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                <span className="fw-bold os-head">Dashboard Menu</span>
                <button
                  type="button"
                  className="os-icon-btn"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent desk={desk} onNavigate={() => setMobileNavOpen(false)} />
            </aside>
          </div>
        )}

        <div id="dash-main" className="os-dash-main" tabIndex={-1} style={{ outline: "none" }}>
          <Outlet />
        </div>
      </div>

      {killModalOpen && <KillSwitchModal onClose={() => setKillModalOpen(false)} />}
    </div>
  );
}

export function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardShellInner />
    </DashboardProvider>
  );
}

/** Designed placeholder inside the dashboard shell for T-2..T-16 until built. */
export function DashboardStubPage({
  code,
  title,
  blurb,
}: {
  code: string;
  title: string;
  blurb: string;
}) {
  usePageStyle("stub", stubCss);
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} (${code}) · OStrade`;
    return () => {
      document.title = prev;
    };
  }, [code, title]);

  return (
    <main className="page-stub">
      <div className="container">
        <div className="os-stub-card">
          <span className="os-stub-icon" aria-hidden>
            <Hammer size={24} />
          </span>
          <span className="os-stub-code os-mono">{code}</span>
          <h1 className="h2 mb-2">{title}</h1>
          <p className="text-secondary mb-3">{blurb}</p>
          <p className="small text-secondary mb-4">
            This trader dashboard screen opens in a later page-by-page build step.
          </p>
          <div className="d-flex flex-wrap gap-2 justify-content-center">
            <Link to="/dashboard" className="os-btn os-btn-primary">
              <Activity size={16} aria-hidden /> Back to Command Center (T-1)
            </Link>
            <Link to="/brokers" className="os-btn os-btn-ghost">
              <BookOpenCheck size={16} aria-hidden /> Capability Matrix
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
