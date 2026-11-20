import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUpRight,
  Bell,
  BellOff,
  CalendarDays,
  Clock3,
  Fingerprint,
  Inbox,
  Layers3,
  ListChecks,
  Radio,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  Zap,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import {
  DeliveryLog,
  Deliverability,
  Digests,
  QuietHours,
} from "@/components/notifications/NotificationDelivery";
import {
  NotificationInbox,
  RoutingMatrix,
} from "@/components/notifications/NotificationInbox";
import { AlertRules } from "@/components/notifications/NotificationRules";
import { TelegramPanel } from "@/components/notifications/NotificationTelegram";
import {
  Button,
  Failure,
  Tag,
} from "@/components/notifications/NotificationUI";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getNotificationOverview,
  notificationKey,
} from "@/services/notifications";
import css from "@/styles/pages/dash-notifications.css?inline";

const sections = [
  ["overview", "Overview", "Notification overview", Layers3],
  ["inbox", "Inbox", "Inbox", Inbox],
  ["routing", "Routing", "Event routing", Route],
  ["rules", "Alert rules", "Alert rules", SlidersHorizontal],
  ["telegram", "Telegram", "Telegram controls", Radio],
  ["digests", "Digests", "Digest settings", CalendarDays],
  ["quiet", "Quiet hours", "Quiet hours", Clock3],
  ["delivery", "Deliverability", "Deliverability", ListChecks],
  ["proof", "Proof log", "Delivery log", Fingerprint],
] as const;
type SectionId = (typeof sections)[number][0];
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
      className="os-nt-section"
      id={`nt-${id}`}
      aria-labelledby={`nt-title-${id}`}
    >
      <header className="os-nt-section-head">
        <div>
          <span className="os-nt-icon os-nt-section-icon">
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`nt-title-${id}`}>{title}</h2>
            <p>{copy}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function DashNotificationsPage() {
  usePageStyle("dash-notifications", css);
  const [active, setActive] = useState<SectionId>("overview"),
    [inbox, setInbox] = useState({ unread: false, id: 0 });
  const q = useQuery({
    queryKey: [...notificationKey, "overview"],
    queryFn: getNotificationOverview,
  });
  useEffect(() => {
    const old = document.title;
    document.title = "Notifications & Alerts | OStrade";
    return () => {
      document.title = old;
    };
  }, []);
  useEffect(() => {
    let frame = 0;
    const listener = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const entered = sections.filter(
          ([id]) =>
            (document.getElementById(`nt-${id}`)?.getBoundingClientRect().top ??
              Infinity) <= 145,
        );
        setActive(
          window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 12
            ? "proof"
            : (entered[entered.length - 1]?.[0] ?? "overview"),
        );
      });
    };
    window.addEventListener("scroll", listener, { passive: true });
    return () => {
      window.removeEventListener("scroll", listener);
      cancelAnimationFrame(frame);
    };
  }, []);
  const jump = (id: SectionId) => {
    setActive(id);
    document.getElementById(`nt-${id}`)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const cards = [
    [
      "Unread",
      q.data?.unread,
      q.data?.critical
        ? `${q.data.critical} critical to review`
        : "Open items in your inbox",
      Bell,
      "teal",
    ],
    ["Today", q.data?.today, "Since midnight EAT", Clock3, "blue"],
    [
      "This week",
      q.data?.week,
      "Monday through today · EAT",
      CalendarDays,
      "neutral",
    ],
    ["Muted classes", q.data?.muted, "Hidden from the inbox", BellOff, "amber"],
  ] as const;
  return (
    <main className="page-dash-notifications" aria-labelledby="nt-heading">
      <header className="os-nt-hero">
        <div className="os-nt-hero-copy">
          <div className="os-nt-kicker">
            <span className="os-nt-icon os-nt-teal">
              <Bell size={17} />
            </span>{" "}
            WORKSPACE COMMS
          </div>
          <h1 id="nt-heading">
            Notifications &amp; Alerts<span>.</span>
          </h1>
          <p>
            Review what happened, choose which events reach you, and test your
            routing without sending a message.
          </p>
          <div className="os-nt-actions">
            <Button
              kind="primary"
              onClick={() => {
                setInbox((i) => ({ unread: true, id: i.id + 1 }));
                jump("inbox");
              }}
            >
              <Inbox size={16} /> Review unread
            </Button>
            <Button onClick={() => jump("routing")}>
              Manage routing <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
        <div className="os-nt-hero-art" aria-hidden="true">
          <div className="os-nt-radar-ring" />
          <div className="os-nt-radar-ring" />
          <div className="os-nt-radar-ring" />
          <div className="os-nt-hero-center">
            <Bell size={58} strokeWidth={1.5} />
            <span>
              <Zap size={16} />
            </span>
          </div>
          <div className="os-nt-float os-nt-float-a">
            <span className="os-nt-icon os-nt-teal">
              <Inbox size={16} />
            </span>
            <div>
              <strong>Local inbox</strong>
              <small>Workspace events</small>
            </div>
          </div>
          <div className="os-nt-float os-nt-float-b">
            <span className="os-nt-icon os-nt-amber">
              <ShieldAlert size={15} />
            </span>
            <div>
              <strong>Critical bypass</strong>
              <small>Quiet-hours aware</small>
            </div>
          </div>
          <span className="os-nt-art-index">OS / COMMS 15</span>
        </div>
      </header>
      <nav className="os-nt-nav" aria-label="Notification sections">
        {sections.map(([id, label, , Icon]) => (
          <button
            type="button"
            key={id}
            aria-current={active === id ? "location" : undefined}
            onClick={() => {
              if (id === "inbox" && inbox.unread)
                setInbox((i) => ({ unread: false, id: i.id + 1 }));
              jump(id);
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      <Section
        id="overview"
        copy="An EAT snapshot of what has arrived and what needs a look."
        action={
          <Tag tone="teal">
            <i className="os-nt-dot" /> Local inbox · external preview
          </Tag>
        }
      >
        <div className="os-nt-metrics" aria-busy={q.isPending}>
          {cards.map(([label, value, caption, Icon, tone]) => (
            <article key={label} className="os-nt-card os-nt-metric">
              <span className={`os-nt-icon os-nt-${tone}`}>
                <Icon size={17} />
              </span>
              <span>{label}</span>
              <strong>
                {value === undefined ? (
                  "—"
                ) : (
                  <CountUp value={value} duration={420} />
                )}
              </strong>
              <small>{caption}</small>
            </article>
          ))}
        </div>
        {q.isError && (
          <>
            <Failure error={q.error} />
            <Button onClick={() => void q.refetch()}>Retry snapshot</Button>
          </>
        )}
      </Section>
      <Section
        id="inbox"
        copy="Filter and inspect notices with their original workspace references."
        action={
          <Tag tone="blue">
            <Timer size={13} /> East Africa Time
          </Tag>
        }
      >
        <NotificationInbox initialUnread={inbox.unread} requestId={inbox.id} />
      </Section>
      <Section
        id="routing"
        copy="Set event-level preferences across in-app, email, SMS, push, and Telegram."
      >
        <RoutingMatrix />
      </Section>
      <Section
        id="rules"
        copy="Use fixed prices, account snapshots, and the economic calendar to test conditions."
      >
        <AlertRules />
      </Section>
      <Section
        id="telegram"
        copy="Manage demo chat scopes and rehearse dashboard actions without a bot connection."
      >
        <TelegramPanel />
      </Section>
      <Section
        id="digests"
        copy="Preview a daily briefing and prepare local weekly or monthly reports."
      >
        <Digests />
      </Section>
      <Section
        id="quiet"
        copy="Set a quiet window in East Africa Time without hiding critical alerts."
      >
        <QuietHours />
      </Section>
      <Section
        id="delivery"
        copy="Review caps, SMS budget, and manual channel tests before a provider is connected."
      >
        <Deliverability />
      </Section>
      <Section
        id="proof"
        copy="Trace how a notice was routed or why a channel was skipped."
      >
        <DeliveryLog />
      </Section>
      <footer className="os-nt-footer">
        <span>
          <Bell size={15} /> OStrade Comms · Local session only
        </span>
        <button
          type="button"
          className="os-nt-link"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            })
          }
        >
          Back to top <ArrowDown size={14} className="os-nt-arrow-up" />
        </button>
      </footer>
    </main>
  );
}
