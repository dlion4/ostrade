import { Route as settingsFileRoute } from "@/routes/dashboard/settings";
import { Route as notificationsFileRoute } from "@/routes/dashboard/notifications";
import { Route as riskFileRoute } from "@/routes/dashboard/risk";
import { Route as copilotFileRoute } from "@/routes/dashboard/copilot";
import { Route as transfersFileRoute } from "@/routes/dashboard/transfers";
import { Route as withdrawalsFileRoute } from "@/routes/dashboard/withdrawals";
import { Route as depositsFileRoute } from "@/routes/dashboard/deposits";
import { Route as accountsFileRoute } from "@/routes/dashboard/accounts";
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
import { Route as recordsFileRoute } from "@/routes/dashboard/records";
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
const recordsMount = { id: "/records", path: "/records", getParentRoute: () => dashboardShellRoute, component: recordsFileRoute.options.component };
const dashRecordsRoute = recordsFileRoute.update(recordsMount);
const accountsMount = { id: "/accounts", path: "/accounts", getParentRoute: () => dashboardShellRoute, component: accountsFileRoute.options.component };
const dashAccountsRoute = accountsFileRoute.update(accountsMount);
const depositsMount = { id: "/deposits", path: "/deposits", getParentRoute: () => dashboardShellRoute, component: depositsFileRoute.options.component };
const dashDepositsRoute = depositsFileRoute.update(depositsMount);
const withdrawalsMount = { id: "/withdrawals", path: "/withdrawals", getParentRoute: () => dashboardShellRoute, component: withdrawalsFileRoute.options.component };
const dashWithdrawalsRoute = withdrawalsFileRoute.update(withdrawalsMount);
const transfersMount = { id: "/transfers", path: "/transfers", getParentRoute: () => dashboardShellRoute, component: transfersFileRoute.options.component };
const dashTransfersRoute = transfersFileRoute.update(transfersMount);
const copilotMount = { id: "/copilot", path: "/copilot", getParentRoute: () => dashboardShellRoute, component: copilotFileRoute.options.component };
const dashCopilotRoute = copilotFileRoute.update(copilotMount);
const riskMount = { id: "/risk", path: "/risk", getParentRoute: () => dashboardShellRoute, component: riskFileRoute.options.component };
const dashRiskRoute = riskFileRoute.update(riskMount);
const notificationsMount = { id: "/notifications", path: "/notifications", getParentRoute: () => dashboardShellRoute, component: notificationsFileRoute.options.component };
const dashNotificationsRoute = notificationsFileRoute.update(notificationsMount);
const settingsMount = { id: "/settings", path: "/settings", getParentRoute: () => dashboardShellRoute, component: settingsFileRoute.options.component };
const dashSettingsRoute = settingsFileRoute.update(settingsMount);

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
  // The standalone preview opens the current Settings workspace. Explicit hash links retain all pages.
  if (!startTarget && typeof window !== "undefined" && !window.location.hash) {
    const path = window.location.pathname;
    appHistory.replace(path === "/" || path.endsWith("/index.html") ? "/dashboard/settings" : path);
  }
  return createRouter({ routeTree, history: appHistory, scrollRestoration: true, defaultPreload: "intent" });
}

export const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
