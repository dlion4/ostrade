import { createFileRoute } from "@tanstack/react-router";
import { DashWithdrawalsPage } from "@/pages/DashWithdrawals";

export const Route = createFileRoute("/dashboard/withdrawals")({ component: DashWithdrawalsPage });
