import { createFileRoute } from "@tanstack/react-router";
import { DashCopilotPage } from "@/pages/DashCopilot";
export const Route = createFileRoute("/dashboard/copilot")({ component: DashCopilotPage });
