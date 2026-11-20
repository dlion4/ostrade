import { createFileRoute } from "@tanstack/react-router";
import { DashSignalDeskPage } from "@/pages/DashSignalDesk";
export const Route = createFileRoute("/dashboard/signals")({
  component: DashSignalDeskPage,
});
