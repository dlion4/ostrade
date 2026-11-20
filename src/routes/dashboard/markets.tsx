import { createFileRoute } from "@tanstack/react-router";
import { DashMarketsPage } from "@/pages/dashboard/DashMarkets";

export const Route = createFileRoute("/dashboard/markets")({
  component: DashMarketsPage,
});
