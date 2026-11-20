import { createFileRoute } from "@tanstack/react-router";
import { DashSchedulerPage } from "@/pages/DashScheduler";
export const Route = createFileRoute("/dashboard/scheduler")({
  component: DashSchedulerPage,
});
