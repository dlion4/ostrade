import { createFileRoute } from "@tanstack/react-router";
import { DashWithdrawalsPage } from "@/pages/dashboard/DashWithdrawals";

export const Route = createFileRoute("/dashboard/withdrawals")({ component: DashWithdrawalsPage });
