import { createFileRoute } from "@tanstack/react-router";
import { BrokersPage } from "@/pages/home/Brokers";

export const Route = createFileRoute("/_marketing/brokers")({
  component: BrokersPage,
});
