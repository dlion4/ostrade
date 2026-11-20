import { createFileRoute } from "@tanstack/react-router";
import { DashPositionsPage } from "@/pages/DashPositions";

export const Route = createFileRoute("/dashboard/positions")({
  component: DashPositionsPage,
});
