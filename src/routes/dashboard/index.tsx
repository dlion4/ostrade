import { createFileRoute } from "@tanstack/react-router";
import { DashCommandCenterPage } from "@/pages/dashboard/DashCommandCenter";

export const Route = createFileRoute("/dashboard/")({
  component: DashCommandCenterPage,
});
