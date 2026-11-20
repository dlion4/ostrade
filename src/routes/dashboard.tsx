import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/DashboardShell";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});
