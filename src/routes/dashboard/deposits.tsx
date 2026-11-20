import { createFileRoute } from "@tanstack/react-router";
import { DashDepositsPage } from "@/pages/dashboard/DashDeposits";

export const Route = createFileRoute("/dashboard/deposits")({ component: DashDepositsPage });
