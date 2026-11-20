import { createFileRoute } from "@tanstack/react-router";
import { DashNotificationsPage } from "@/pages/DashNotifications";
export const Route = createFileRoute("/dashboard/notifications")({
  component: DashNotificationsPage,
});
