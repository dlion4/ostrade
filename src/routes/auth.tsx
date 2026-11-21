import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Auth layout: bare workspace chrome — no marketing nav or footer. */
export const Route = createFileRoute("/auth")({
  component: () => <Outlet />,
});
