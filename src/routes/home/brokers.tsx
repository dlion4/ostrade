import { createFileRoute } from "@tanstack/react-router";
import { BrokersPage } from "@/pages/home/Brokers";

export const Route = createFileRoute("/home/brokers")({
  component: BrokersPage,
});
