import { createFileRoute } from "@tanstack/react-router";
import { DashRiskPage } from "@/pages/DashRisk";
export const Route = createFileRoute("/dashboard/risk")({
  component: DashRiskPage,
});
