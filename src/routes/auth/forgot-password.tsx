import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/forgot-password")({
  component: () => (
    <StubPage
      code="A-5"
      title="Forgot password"
      blurb="Request a password reset link."
    />
  ),
});
