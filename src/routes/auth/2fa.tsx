import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/2fa")({
  component: () => (
    <StubPage
      code="A-8"
      title="Two-factor authentication"
      blurb="Add a second factor before enabling live trading."
    />
  ),
});
