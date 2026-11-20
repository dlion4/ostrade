import { useEffect, useState, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Blocks,
  Database,
  Fingerprint,
  Globe2,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Palette,
  Plug,
  Radio,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  WifiOff,
} from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import * as api from "@/services/settings";
import {
  Badge,
  Button,
  Feedback,
  settingsKey,
} from "@/components/settings/SettingsUI";
import {
  Profile,
  SecurityAccess,
} from "@/components/settings/SettingsSecurity";
import { Tokens, Webhooks } from "@/components/settings/SettingsEndpoints";
import {
  Appearance,
  Brokers,
  Locale,
} from "@/components/settings/SettingsPreferences";
import {
  Flags,
  Integrations,
  Privacy,
} from "@/components/settings/SettingsGovernance";
import css from "@/styles/pages/dash-settings.css?inline";
const sections = [
  [
    "overview",
    "Overview",
    "Workspace overview",
    "See the current configuration at a glance.",
    LayoutGrid,
  ],
  [
    "profile",
    "Profile",
    "Profile",
    "Manage identity and login preferences for this demo workspace.",
    UserRound,
  ],
  [
    "security",
    "Security",
    "Security & sessions",
    "Review authentication, recovery and device access.",
    ShieldCheck,
  ],
  [
    "webhooks",
    "Webhooks",
    "Webhooks",
    "Configure inbound sources and rehearse signed callbacks.",
    Radio,
  ],
  [
    "tokens",
    "API tokens",
    "API tokens",
    "Create, rotate and revoke non-functional scoped tokens.",
    KeyRound,
  ],
  [
    "appearance",
    "Appearance",
    "Appearance",
    "Make the workspace easier to scan and customize visual preferences.",
    Palette,
  ],
  [
    "locale",
    "Locale",
    "Units & locale",
    "Preview fixed currency conversions, timezones, units and formats.",
    Globe2,
  ],
  [
    "brokers",
    "Brokers",
    "Broker defaults",
    "Manage account defaults, symbol suffixes and adapter visibility.",
    SlidersHorizontal,
  ],
  [
    "privacy",
    "Privacy",
    "Data & privacy",
    "Export local records and review retention, consent and deletion.",
    Database,
  ],
  [
    "flags",
    "Feature flags",
    "Feature flags",
    "Keep separate configurations for Paper, Demo and Live.",
    Blocks,
  ],
  [
    "integrations",
    "Integrations",
    "Integrations",
    "Review provider readiness without opening connections.",
    Plug,
  ],
] as const;
type Anchor = (typeof sections)[number][0];
function Result<T>({
  q,
  children,
}: {
  q: UseQueryResult<T>;
  children: (v: T) => ReactNode;
}) {
  if (q.data) return children(q.data);
  if (q.error)
    return (
      <div className="os-st-card os-st-state">
        <Feedback error={q.error} />
        <Button onClick={() => void q.refetch()}>Retry</Button>
      </div>
    );
  return (
    <div
      role="status"
      aria-label="Loading settings"
      className="os-st-card os-st-state os-st-skeleton"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
export function DashSettingsPage() {
  usePageStyle("dash-settings", css);
  const [active, setActive] = useState<Anchor>("overview");
  const query = <T,>(section: string, queryFn: () => Promise<T>) => ({
    queryKey: [...settingsKey, section],
    queryFn,
  });
  const security = useQuery(query("security", api.getSettingsSecurity)),
    hooks = useQuery(query("webhooks", api.getSettingsWebhooks)),
    tokens = useQuery(query("tokens", api.getSettingsTokens)),
    prefs = useQuery(query("preferences", api.getSettingsPreferences)),
    brokers = useQuery(query("brokers", api.getSettingsBrokers)),
    features = useQuery(query("features", api.getSettingsFeatures));
  const privacy = useQuery({
    ...query("privacy", api.getSettingsPrivacy),
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => j.status === "Queued") ? 650 : false,
  });
  const reduced = prefs.data?.appearance.motion === "reduce",
    compact = prefs.data?.appearance.density === "compact";
  const jump = (id: Anchor) => {
    setActive(id);
    const target = document.getElementById(`st-${id}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      behavior:
        reduced || matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
  };
  useEffect(() => {
    const previous = document.title;
    document.title = "Workspace Settings | OStrade";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    const anchor = document.getElementById(`st-nav-${active}`);
    const nav = anchor?.parentElement;
    if (!anchor || !nav || nav.scrollWidth <= nav.clientWidth) return;
    const item = anchor.getBoundingClientRect(),
      frame = nav.getBoundingClientRect();
    if (item.left < frame.left) nav.scrollLeft -= frame.left - item.left + 6;
    if (item.right > frame.right)
      nav.scrollLeft += item.right - frame.right + 6;
  }, [active]);
  const summaries = [
    {
      label: "Security",
      value: "2FA enabled",
      caption: "Demo authenticator",
      icon: Fingerprint,
      go: "security",
    },
    {
      label: "Active sessions",
      value: security.data
        ? String(
            security.data.sessions.filter((s) => s.state === "Active").length,
          )
        : "—",
      caption: "Includes this browser",
      icon: LockKeyhole,
      go: "security",
    },
    {
      label: "Webhook sources",
      value: hooks.data ? String(hooks.data.inbound.length) : "—",
      caption: "Example endpoints only",
      icon: Radio,
      go: "webhooks",
    },
    {
      label: "Integrations",
      value: "Offline",
      caption: "No external requests",
      icon: WifiOff,
      go: "integrations",
    },
  ] as const;
  return (
    <main
      className={`page-dash-settings${compact ? " os-st-compact" : ""}${reduced ? " os-st-reduce" : ""}`}
    >
      <header className="os-st-hero">
        <div className="os-st-hero-content">
          <div className="os-st-hero-kicker">
            <span>
              <Settings2 size={19} />
            </span>
            <span className="os-st-kicker">WORKSPACE ADMINISTRATION</span>
          </div>
          <h1>
            Workspace Settings<span>.</span>
          </h1>
          <p>
            Manage workspace security, broker defaults, and integrations from
            one place. Review what’s saved locally and what still needs a
            backend.
          </p>
          <div className="os-st-actions">
            <Button kind="primary" onClick={() => jump("security")}>
              <ShieldCheck size={16} /> Review security
            </Button>
            <Button onClick={() => jump("webhooks")}>
              Manage webhooks <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
        <div className="os-st-hero-art" aria-hidden="true">
          <div className="os-st-orbit os-st-orbit-1" />
          <div className="os-st-orbit os-st-orbit-2" />
          <div className="os-st-orbit os-st-orbit-3" />
          <div className="os-st-hero-tile">
            <SlidersHorizontal size={56} />
          </div>
          <div className="os-st-art-label os-st-label-one">
            <LockKeyhole size={19} />
            <div>
              <strong>Access control</strong>
              <small>Identity & permissions</small>
            </div>
          </div>
          <div className="os-st-art-label os-st-label-two">
            <Plug size={19} />
            <div>
              <strong>Offline mode</strong>
              <small>Preview only</small>
            </div>
          </div>
          <span className="os-st-art-caption">OS / ADMIN 16</span>
        </div>
      </header>
      <nav className="os-st-nav" aria-label="Settings sections">
        {sections.map(([id, label, , , Icon]) => (
          <button
            type="button"
            key={id}
            id={`st-nav-${id}`}
            aria-current={active === id ? "location" : undefined}
            onClick={() => jump(id)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {sections.map(([id, , title, copy, Icon]) => (
        <section
          key={id}
          id={`st-${id}`}
          tabIndex={-1}
          className="os-st-section"
          aria-labelledby={`st-title-${id}`}
        >
          <header className="os-st-section-head">
            <span>
              <Icon size={18} />
            </span>
            <div>
              <h2 id={`st-title-${id}`}>{title}</h2>
              <p>{copy}</p>
            </div>
            {id === "overview" && (
              <Badge tone="good">Local workspace · admin</Badge>
            )}
          </header>
          {id === "overview" && (
            <div className="os-st-metrics">
              {summaries.map((r) => (
                <button
                  type="button"
                  className="os-st-card os-st-metric"
                  key={r.label}
                  onClick={() => jump(r.go)}
                >
                  <span>
                    <r.icon size={16} />
                    {r.label}
                    <ArrowUpRight size={13} />
                  </span>
                  <strong>{r.value}</strong>
                  <small>{r.caption}</small>
                </button>
              ))}
            </div>
          )}
          {id === "profile" && (
            <Result q={security}>{(data) => <Profile data={data} />}</Result>
          )}
          {id === "security" && (
            <Result q={security}>
              {(data) => <SecurityAccess data={data} />}
            </Result>
          )}
          {id === "webhooks" && (
            <Result q={hooks}>{(data) => <Webhooks data={data} />}</Result>
          )}
          {id === "tokens" && (
            <Result q={tokens}>{(data) => <Tokens data={data} />}</Result>
          )}
          {id === "appearance" && (
            <Result q={prefs}>
              {(data) => <Appearance data={data.appearance} />}
            </Result>
          )}
          {id === "locale" && (
            <Result q={prefs}>
              {(data) => <Locale data={data.locale} rate={data.sampleUsdKes} />}
            </Result>
          )}
          {id === "brokers" && (
            <Result q={brokers}>{(data) => <Brokers data={data} />}</Result>
          )}
          {id === "privacy" && (
            <Result q={privacy}>{(data) => <Privacy data={data} />}</Result>
          )}
          {id === "flags" && (
            <Result q={features}>{(data) => <Flags data={data} />}</Result>
          )}
          {id === "integrations" && (
            <Result q={features}>
              {(data) => <Integrations data={data} />}
            </Result>
          )}
        </section>
      ))}
      <footer className="os-st-footer">
        <span>OSTRADE / WORKSPACE CONFIGURATION</span>
        <span>Frontend preview · no broker or provider connections</span>
      </footer>
    </main>
  );
}
