import {
  Outlet,
  createHashHistory,
  createBrowserHistory,
  createMemoryHistory,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Route as rootRoute } from "@/routes/__root";

/* ── File routes, organised by category ──────────────────── */
// Home (public marketing): routes/home/*
import { Route as homeIndexFileRoute } from "@/routes/home/index";
import { Route as brokersFileRoute } from "@/routes/home/brokers";
import { Route as howItWorksFileRoute } from "@/routes/home/how-it-works";
import { Route as statusFileRoute } from "@/routes/home/status";
import { Route as legalDocFileRoute } from "@/routes/home/legal.$doc";
// Auth: routes/auth/*
import { Route as signinFileRoute } from "@/routes/auth/signin";
import { Route as signupFileRoute } from "@/routes/auth/signup";
import { Route as brokerConnectFileRoute } from "@/routes/auth/broker-connect";
import { Route as onboardFileRoute } from "@/routes/auth/onboard";
import { Route as verifyOtpFileRoute } from "@/routes/auth/verify-otp";
import { Route as twoFactorFileRoute } from "@/routes/auth/2fa";
import { Route as forgotFileRoute } from "@/routes/auth/forgot-password";
import { Route as resetFileRoute } from "@/routes/auth/reset-password";
// Dashboard: routes/dashboard/*
import { Route as dashboardFileRoute } from "@/routes/dashboard";
import { Route as dashIndexFileRoute } from "@/routes/dashboard/index";
import { Route as marketsFileRoute } from "@/routes/dashboard/markets";
import { Route as tradeFileRoute } from "@/routes/dashboard/trade";
import { Route as signalsFileRoute } from "@/routes/dashboard/signals";
import { Route as automationFileRoute } from "@/routes/dashboard/automation";
import { Route as schedulerFileRoute } from "@/routes/dashboard/scheduler";
import { Route as recordsFileRoute } from "@/routes/dashboard/records";
import { Route as positionsFileRoute } from "@/routes/dashboard/positions";
import { Route as accountsFileRoute } from "@/routes/dashboard/accounts";
import { Route as depositsFileRoute } from "@/routes/dashboard/deposits";
import { Route as withdrawalsFileRoute } from "@/routes/dashboard/withdrawals";
import { Route as transfersFileRoute } from "@/routes/dashboard/transfers";
import { Route as copilotFileRoute } from "@/routes/dashboard/copilot";
import { Route as riskFileRoute } from "@/routes/dashboard/risk";
import { Route as notificationsFileRoute } from "@/routes/dashboard/notifications";
import { Route as settingsFileRoute } from "@/routes/dashboard/settings";

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

/* ── Route tree: public paths wired from the category files ── */

const layout = createRoute({
  getParentRoute: () => rootRoute,
  id: "marketing",
  component: MarketingLayout,
});

// Home (public): "/" is the default home page

const homeIndexRouteMount = {
  id: "/",
  path: "/",
  getParentRoute: () => layout,
  component: homeIndexFileRoute.options.component,
};
const homeIndexRoute = homeIndexFileRoute.update(homeIndexRouteMount);

const brokersRouteMount = {
  id: "/brokers",
  path: "/brokers",
  getParentRoute: () => layout,
  component: brokersFileRoute.options.component,
};
const brokersRoute = brokersFileRoute.update(brokersRouteMount);

const howRouteMount = {
  id: "/how-it-works",
  path: "/how-it-works",
  getParentRoute: () => layout,
  component: howItWorksFileRoute.options.component,
};
const howRoute = howItWorksFileRoute.update(howRouteMount);

const statusRouteMount = {
  id: "/status",
  path: "/status",
  getParentRoute: () => layout,
  component: statusFileRoute.options.component,
};
const statusRoute = statusFileRoute.update(statusRouteMount);

const legalRouteMount = {
  id: "/legal/$doc",
  path: "/legal/$doc",
  getParentRoute: () => layout,
  component: legalDocFileRoute.options.component,
};
const legalRoute = legalDocFileRoute.update(legalRouteMount);

// Auth

const signinRouteMount = {
  id: "/auth/signin",
  path: "/auth/signin",
  getParentRoute: () => layout,
  component: signinFileRoute.options.component,
};
const signinRoute = signinFileRoute.update(signinRouteMount);

const signupRouteMount = {
  id: "/auth/signup",
  path: "/auth/signup",
  getParentRoute: () => layout,
  component: signupFileRoute.options.component,
};
const signupRoute = signupFileRoute.update(signupRouteMount);

const brokerConnectRouteMount = {
  id: "/auth/broker-connect",
  path: "/auth/broker-connect",
  getParentRoute: () => layout,
  component: brokerConnectFileRoute.options.component,
};
const brokerConnectRoute = brokerConnectFileRoute.update(brokerConnectRouteMount);

const onboardRouteMount = {
  id: "/auth/onboard",
  path: "/auth/onboard",
  getParentRoute: () => layout,
  component: onboardFileRoute.options.component,
};
const onboardRoute = onboardFileRoute.update(onboardRouteMount);

const verifyOtpRouteMount = {
  id: "/auth/verify-otp",
  path: "/auth/verify-otp",
  getParentRoute: () => layout,
  component: verifyOtpFileRoute.options.component,
};
const verifyOtpRoute = verifyOtpFileRoute.update(verifyOtpRouteMount);

const twoFactorRouteMount = {
  id: "/auth/2fa",
  path: "/auth/2fa",
  getParentRoute: () => layout,
  component: twoFactorFileRoute.options.component,
};
const twoFactorRoute = twoFactorFileRoute.update(twoFactorRouteMount);

const forgotRouteMount = {
  id: "/auth/forgot-password",
  path: "/auth/forgot-password",
  getParentRoute: () => layout,
  component: forgotFileRoute.options.component,
};
const forgotRoute = forgotFileRoute.update(forgotRouteMount);

const resetRouteMount = {
  id: "/auth/reset-password",
  path: "/auth/reset-password",
  getParentRoute: () => layout,
  component: resetFileRoute.options.component,
};
const resetRoute = resetFileRoute.update(resetRouteMount);

// Trader dashboard (T-1..T-16)
const dashboardMount = {
  id: "/dashboard",
  path: "/dashboard",
  getParentRoute: () => rootRoute,
  component: dashboardFileRoute.options.component,
};
const dashboardShellRoute = dashboardFileRoute.update(dashboardMount);

const dashIndexRouteMount = {
  id: "/",
  path: "/",
  getParentRoute: () => dashboardShellRoute,
  component: dashIndexFileRoute.options.component,
};
const dashIndexRoute = dashIndexFileRoute.update(dashIndexRouteMount);

const dashMarketsRouteMount = {
  id: "/markets",
  path: "/markets",
  getParentRoute: () => dashboardShellRoute,
  component: marketsFileRoute.options.component,
};
const dashMarketsRoute = marketsFileRoute.update(dashMarketsRouteMount);

const dashTradeRouteMount = {
  id: "/trade",
  path: "/trade",
  getParentRoute: () => dashboardShellRoute,
  component: tradeFileRoute.options.component,
};
const dashTradeRoute = tradeFileRoute.update(dashTradeRouteMount);

const dashSignalsRouteMount = {
  id: "/signals",
  path: "/signals",
  getParentRoute: () => dashboardShellRoute,
  component: signalsFileRoute.options.component,
};
const dashSignalsRoute = signalsFileRoute.update(dashSignalsRouteMount);

const dashAutomationRouteMount = {
  id: "/automation",
  path: "/automation",
  getParentRoute: () => dashboardShellRoute,
  component: automationFileRoute.options.component,
};
const dashAutomationRoute = automationFileRoute.update(dashAutomationRouteMount);

const dashSchedulerRouteMount = {
  id: "/scheduler",
  path: "/scheduler",
  getParentRoute: () => dashboardShellRoute,
  component: schedulerFileRoute.options.component,
};
const dashSchedulerRoute = schedulerFileRoute.update(dashSchedulerRouteMount);

const dashRecordsRouteMount = {
  id: "/records",
  path: "/records",
  getParentRoute: () => dashboardShellRoute,
  component: recordsFileRoute.options.component,
};
const dashRecordsRoute = recordsFileRoute.update(dashRecordsRouteMount);

const dashPositionsRouteMount = {
  id: "/positions",
  path: "/positions",
  getParentRoute: () => dashboardShellRoute,
  component: positionsFileRoute.options.component,
};
const dashPositionsRoute = positionsFileRoute.update(dashPositionsRouteMount);

const dashAccountsRouteMount = {
  id: "/accounts",
  path: "/accounts",
  getParentRoute: () => dashboardShellRoute,
  component: accountsFileRoute.options.component,
};
const dashAccountsRoute = accountsFileRoute.update(dashAccountsRouteMount);

const dashDepositsRouteMount = {
  id: "/deposits",
  path: "/deposits",
  getParentRoute: () => dashboardShellRoute,
  component: depositsFileRoute.options.component,
};
const dashDepositsRoute = depositsFileRoute.update(dashDepositsRouteMount);

const dashWithdrawalsRouteMount = {
  id: "/withdrawals",
  path: "/withdrawals",
  getParentRoute: () => dashboardShellRoute,
  component: withdrawalsFileRoute.options.component,
};
const dashWithdrawalsRoute = withdrawalsFileRoute.update(dashWithdrawalsRouteMount);

const dashTransfersRouteMount = {
  id: "/transfers",
  path: "/transfers",
  getParentRoute: () => dashboardShellRoute,
  component: transfersFileRoute.options.component,
};
const dashTransfersRoute = transfersFileRoute.update(dashTransfersRouteMount);

const dashCopilotRouteMount = {
  id: "/copilot",
  path: "/copilot",
  getParentRoute: () => dashboardShellRoute,
  component: copilotFileRoute.options.component,
};
const dashCopilotRoute = copilotFileRoute.update(dashCopilotRouteMount);

const dashRiskRouteMount = {
  id: "/risk",
  path: "/risk",
  getParentRoute: () => dashboardShellRoute,
  component: riskFileRoute.options.component,
};
const dashRiskRoute = riskFileRoute.update(dashRiskRouteMount);

const dashNotificationsRouteMount = {
  id: "/notifications",
  path: "/notifications",
  getParentRoute: () => dashboardShellRoute,
  component: notificationsFileRoute.options.component,
};
const dashNotificationsRoute = notificationsFileRoute.update(dashNotificationsRouteMount);

const dashSettingsRouteMount = {
  id: "/settings",
  path: "/settings",
  getParentRoute: () => dashboardShellRoute,
  component: settingsFileRoute.options.component,
};
const dashSettingsRoute = settingsFileRoute.update(dashSettingsRouteMount);

const routeTree = rootRoute.addChildren([
  layout.addChildren([
    homeIndexRoute,
    brokersRoute,
    howRoute,
    statusRoute,
    legalRoute,
    signinRoute,
    signupRoute,
    brokerConnectRoute,
    onboardRoute,
    verifyOtpRoute,
    twoFactorRoute,
    forgotRoute,
    resetRoute,
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
  const appHistory =
    typeof window === "undefined"
      ? createMemoryHistory()
      : startTarget
        ? createBrowserHistory()
        : createHashHistory();
  return createRouter({
    routeTree,
    history: appHistory,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

export const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
