import { createFileRoute } from "@tanstack/react-router";
import { DashTradeTicketPage } from "@/pages/dashboard/DashTradeTicket";

export const Route = createFileRoute("/dashboard/trade")({
  component: DashTradeTicketPage,
});
