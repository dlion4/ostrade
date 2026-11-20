import { createFileRoute } from "@tanstack/react-router";
import { DashAutomationPage } from "@/pages/DashAutomation";

export const Route = createFileRoute("/dashboard/automation")({ component: DashAutomationPage });
