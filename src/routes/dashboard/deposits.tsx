import { createFileRoute } from "@tanstack/react-router";
import { DashDepositsPage } from "@/pages/DashDeposits";

export const Route = createFileRoute("/dashboard/deposits")({ component: DashDepositsPage });
