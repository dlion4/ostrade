import { createFileRoute } from "@tanstack/react-router";
import { DashAutomationPage } from "@/pages/dashboard/DashAutomation";

export const Route = createFileRoute("/dashboard/automation")({
  validateSearch: (search: Record<string, unknown>): { recordSource?: string } => ({ recordSource: typeof search.recordSource === "string" ? search.recordSource : undefined }),
  component: DashAutomationPage,
});
