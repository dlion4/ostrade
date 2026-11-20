import { createFileRoute } from "@tanstack/react-router";
import { DashTransfersPage } from "@/pages/dashboard/DashTransfers";
export const Route = createFileRoute("/dashboard/transfers")({ component: DashTransfersPage });
