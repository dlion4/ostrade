import { createFileRoute } from "@tanstack/react-router";
import { DashAccountsPage } from "@/pages/DashAccounts";

export const Route = createFileRoute("/dashboard/accounts")({ component: DashAccountsPage });
