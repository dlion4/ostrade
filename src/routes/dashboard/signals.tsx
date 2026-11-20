import { createFileRoute } from "@tanstack/react-router";
import { DashSignalDeskPage } from "@/pages/DashSignalDesk";
export const Route = createFileRoute("/dashboard/signals")({
  validateSearch: (search: Record<string, unknown>): { recordSource?: string } => ({ recordSource: typeof search.recordSource === "string" ? search.recordSource : undefined }),
  component: DashSignalDeskPage,
});
