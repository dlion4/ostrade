import { createFileRoute } from "@tanstack/react-router";
import { DashCopilotPage } from "@/pages/DashCopilot";
export const Route = createFileRoute("/dashboard/copilot")({
  component: DashCopilotPage,
  validateSearch: (value: Record<string,unknown>): { proposal?: string } => typeof value.proposal==='string'&&/^AI-[a-z0-9-]{1,32}$/i.test(value.proposal)?{proposal:value.proposal}:{},
});
