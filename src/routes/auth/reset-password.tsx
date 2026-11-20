import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/reset-password")({
  component: () => (
    <StubPage
      code="A-6"
      title="Reset password"
      blurb="Choose a new password that meets the 10-character policy."
    />
  ),
});
