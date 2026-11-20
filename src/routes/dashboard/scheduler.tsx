import { createFileRoute } from "@tanstack/react-router";
import { DashSchedulerPage } from "@/pages/DashScheduler";
export const Route = createFileRoute("/dashboard/scheduler")({
  validateSearch: (search: Record<string, unknown>): { recordSource?: string } => ({ recordSource: typeof search.recordSource === "string" ? search.recordSource : undefined }),
  component: DashSchedulerPage,
});
