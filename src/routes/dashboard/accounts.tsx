import { createFileRoute } from "@tanstack/react-router";
import { DashAccountsPage } from "@/pages/dashboard/DashAccounts";

export const Route = createFileRoute("/dashboard/accounts")({ component: DashAccountsPage });
