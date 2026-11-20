import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/broker-connect")({
  component: () => (
    <StubPage
      code="A-4"
      title="Connect a broker"
      blurb="Link Deriv, Exness/MT5 or a paper account."
    />
  ),
});
