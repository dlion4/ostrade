import { createFileRoute } from "@tanstack/react-router";
import { BrokerConnectPage } from "@/pages/auth/AuthBrokerConnect";

export const Route = createFileRoute("/auth/broker-connect")({
  component: BrokerConnectPage,
});
