import { createFileRoute } from "@tanstack/react-router";
import { DashSettingsPage } from "@/pages/DashSettings";
export const Route = createFileRoute("/dashboard/settings")({
  component: DashSettingsPage,
});
