import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/onboard")({
  component: () => (
    <StubPage
      code="A-3"
      title="Onboarding preferences"
      blurb="Base currency, trading hours, default account and risk limits."
    />
  ),
});
