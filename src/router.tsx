import {
  Outlet,
  createHashHistory,
  createBrowserHistory,
  createMemoryHistory,
  createRoute,
  createRouter,
  useParams,
} from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { DashboardStubPage } from "@/components/DashboardShell";
import { Route as rootRoute } from "@/routes/__root";
import { Route as dashboardFileRoute } from "@/routes/dashboard";
import { LandingPage } from "@/pages/Landing";
import { BrokersPage } from "@/pages/Brokers";
import { HowItWorksPage } from "@/pages/HowItWorks";
import { StubPage } from "@/pages/Stub";
import { SignupPage } from "@/pages/AuthSignup";
import { SigninPage } from "@/pages/AuthSignin";
import { DashCommandCenterPage } from "@/pages/DashCommandCenter";
import { DashMarketsPage } from "@/pages/DashMarkets";
import { DashTradeTicketPage } from "@/pages/DashTradeTicket";
import { Route as signalDeskFileRoute } from "@/routes/dashboard/signals";
import { Route as automationFileRoute } from "@/routes/dashboard/automation";
import { Route as schedulerFileRoute } from "@/routes/dashboard/scheduler";
import { Route as positionsFileRoute } from "@/routes/dashboard/positions";

function MarketingLayout() {
  return (
    <>
      <a
        href="#main"
        className="visually-hidden-focusable os-skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <MarketingNav />
      <div id="main" tabIndex={-1} style={{ outline: "none" }}>
        <Outlet />
      </div>
      <MarketingFooter />
    </>
  );
}

const layout = createRoute({
  getParentRoute: () => rootRoute,
  id: "marketing",
  component: MarketingLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => layout,
  path: "/",
  component: LandingPage,
});

const stub = <P extends string>(
  path: P,
  code: string,
  title: string,
  blurb: string
) =>
  createRoute({
    getParentRoute: () => layout,
    path,
    component: () => <StubPage code={code} title={title} blurb={blurb} />,
  });

const brokersRoute = createRoute({
  getParentRoute: () => layout,
  path: "/brokers",
  component: BrokersPage,
});
const howRoute = createRoute({
  getParentRoute: () => layout,
  path: "/how-it-works",
  component: HowItWorksPage,
});
const signupRoute = createRoute({
  getParentRoute: () => layout,
  path: "/auth/signup",
  component: SignupPage,
});
const onboardRoute = stub(
  "/auth/onboard",
  "A-3",
  "Onboarding preferences",
  "Base currency, trading hours, default account and risk limits."
);
const verifyOtpRoute = stub(
  "/auth/verify-otp",
  "A-7",
  "Verify your OTP",
  "Enter the 6-digit code sent to your email or phone."
);
const twoFactorRoute = stub(
  "/auth/2fa",
  "A-8",
  "Two-factor authentication",
  "Add a second factor before enabling live trading."
);
const forgotRoute = stub(
  "/auth/forgot-password",
  "A-5",
  "Forgot password",
  "Request a password reset link."
);
const resetRoute = stub(
  "/auth/reset-password",
  "A-6",
  "Reset password",
  "Choose a new password that meets the 10-character policy."
);
const signinRoute = createRoute({
  getParentRoute: () => layout,
  path: "/auth/signin",
  component: SigninPage,
});
const statusRoute = stub(
  "/status",
  "OPS",
  "System status",
  "Sign-in, broker adapter and scheduler health in one read-only panel."
);
const brokerConnectRoute = stub(
  "/auth/broker-connect",
  "A-4",
  "Connect a broker",
  "Link Deriv, Exness/MT5 or a paper account."
);

const LEGAL: Record<string, { title: string; blurb: string }> = {
  privacy: {
    title: "Privacy policy",
    blurb: "How OStrade handles your data and encrypted broker credentials.",
  },
  terms: {
    title: "Terms of service",
    blurb: "The rules for using OStrade.",
  },
  risk: {
    title: "Risk disclosure",
    blurb: "Trading involves a high risk of loss. Read this before going live.",
  },
};
function LegalStub() {
  const { doc } = useParams({ from: "/marketing/legal/$doc" });
  const d = LEGAL[doc] ?? LEGAL.risk;
  return <StubPage code="LEGAL" title={d.title} blurb={d.blurb} />;
}
const legalRoute = createRoute({
  getParentRoute: () => layout,
  path: "/legal/$doc",
  component: LegalStub,
});

/* ── Trader Dashboard Route Tree (T-1..T-16) ─────────────── */

const dashboardMount = { id: "/dashboard", path: "/dashboard", getParentRoute: () => rootRoute, component: dashboardFileRoute.options.component };
const dashboardShellRoute = dashboardFileRoute.update(dashboardMount);

const dashIndexRoute = createRoute({
  getParentRoute: () => dashboardShellRoute,
  path: "/",
  component: DashCommandCenterPage,
});

const dashStub = <P extends string>(
  path: P,
  code: string,
  title: string,
  blurb: string
) =>
  createRoute({
    getParentRoute: () => dashboardShellRoute,
    path,
    component: () => (
      <DashboardStubPage code={code} title={title} blurb={blurb} />
    ),
  });

const dashMarketsRoute = createRoute({
  getParentRoute: () => dashboardShellRoute,
  path: "markets",
  component: DashMarketsPage,
});
const dashTradeRoute = createRoute({
  getParentRoute: () => dashboardShellRoute,
  path: "trade",
  component: DashTradeTicketPage,
});
const signalDeskMount = {
  id: "/signals", path: "/signals", getParentRoute: () => dashboardShellRoute,
  component: signalDeskFileRoute.options.component,
};
const dashSignalsRoute = signalDeskFileRoute.update(signalDeskMount);
const automationMount = { id: "/automation", path: "/automation", getParentRoute: () => dashboardShellRoute, component: automationFileRoute.options.component };
const dashAutomationRoute = automationFileRoute.update(automationMount);
const schedulerMount = { id: "/scheduler", path: "/scheduler", getParentRoute: () => dashboardShellRoute, component: schedulerFileRoute.options.component };
const dashSchedulerRoute = schedulerFileRoute.update(schedulerMount);
const positionsMount = { id: "/positions", path: "/positions", getParentRoute: () => dashboardShellRoute, component: positionsFileRoute.options.component };
const dashPositionsRoute = positionsFileRoute.update(positionsMount);
const dashRecordsRoute = dashStub(
  "records",
  "T-8",
  "Trade Records & Analytics",
  "Complete execution journal, channel expectancy breakdown, and CSV export."
);
const dashAccountsRoute = dashStub(
  "accounts",
  "T-9",
  "Accounts & Broker Hub",
  "Connected Paper, Deriv, Exness/MT5, and standby adapter slots."
);
const dashDepositsRoute = dashStub(
  "deposits",
  "T-10",
  "Deposits",
  "Capability-aware API, hosted cashier deep-link, and manual proof rails."
);
const dashWithdrawalsRoute = dashStub(
  "withdrawals",
  "T-11",
  "Withdrawals",
  "Safety-ladder withdrawal requests reconciled into the double-entry ledger."
);
const dashTransfersRoute = dashStub(
  "transfers",
  "T-12",
  "Transfers & Double-Entry Ledger",
  "Internal account transfers and automated debit/credit ledger postings."
);
const dashCopilotRoute = dashStub(
  "copilot",
  "T-13",
  "AI Co-Pilot",
  "Journal-aware trade reviews and approval-gated execution drafts."
);
const dashRiskRoute = dashStub(
  "risk",
  "T-14",
  "Risk & Guardrails",
  "Daily loss caps, max lot limits, duplicate shields, and kill-switch audit log."
);
const dashNotificationsRoute = dashStub(
  "notifications",
  "T-15",
  "Notifications & Alerts",
  "Adapter health notices, guardrail triggers, and delivery channel rules."
);
const dashSettingsRoute = dashStub(
  "settings",
  "T-16",
  "Workspace Settings",
  "Master-admin operator preferences, display currency, and security settings."
);

const routeTree = rootRoute.addChildren([
  layout.addChildren([
    indexRoute,
    brokersRoute,
    howRoute,
    signupRoute,
    signinRoute,
    brokerConnectRoute,
    onboardRoute,
    verifyOtpRoute,
    twoFactorRoute,
    forgotRoute,
    resetRoute,
    statusRoute,
    legalRoute,
  ]),
  dashboardShellRoute.addChildren([
    dashIndexRoute,
    dashMarketsRoute,
    dashTradeRoute,
    dashSignalsRoute,
    dashAutomationRoute,
    dashSchedulerRoute,
    dashPositionsRoute,
    dashRecordsRoute,
    dashAccountsRoute,
    dashDepositsRoute,
    dashWithdrawalsRoute,
    dashTransfersRoute,
    dashCopilotRoute,
    dashRiskRoute,
    dashNotificationsRoute,
    dashSettingsRoute,
  ]),
]);

export function getRouter() {
  const startTarget = import.meta.env.VITE_OS_START === "true";
  const appHistory = typeof window === "undefined" ? createMemoryHistory() : startTarget ? createBrowserHistory() : createHashHistory();
  // The standalone preview opens the current desk. Explicit hash links retain all pages.
  if (!startTarget && typeof window !== "undefined" && !window.location.hash) {
    const path = window.location.pathname;
    appHistory.replace(path === "/" || path.endsWith("/index.html") ? "/dashboard/automation" : path);
  }
  return createRouter({ routeTree, history: appHistory, scrollRestoration: true, defaultPreload: "intent" });
}

export const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
