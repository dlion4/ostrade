import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/auth/verify-otp")({
  component: () => (
    <StubPage
      code="A-7"
      title="Verify your OTP"
      blurb="Enter the 6-digit code sent to your email or phone."
    />
  ),
});
