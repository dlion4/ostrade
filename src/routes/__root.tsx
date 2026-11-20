import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AppProviders } from "@/components/AppProviders";
import "@/index.css";

function Document({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_OS_START !== "true") return <>{children}</>;
  return (
    <html lang="en" data-bs-theme="light" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "OStrade | Trading workspace" },
    ],
  }),
  shellComponent: Document,
  component: () => (
    <AppProviders>
      <Outlet />
    </AppProviders>
  ),
});
