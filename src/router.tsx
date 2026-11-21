import {
  createHashHistory,
  createBrowserHistory,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

/**
 * The route tree is generated from the organised file routes
 * (src/routes/_marketing, src/routes/auth, src/routes/dashboard) — see
 * routeTree.gen.ts. This module only supplies history and registration.
 */
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
