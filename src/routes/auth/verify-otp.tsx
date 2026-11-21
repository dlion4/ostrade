import { createFileRoute } from "@tanstack/react-router";
import { VerifyOtpPage } from "@/pages/auth/AuthVerifyOtp";

export const Route = createFileRoute("/auth/verify-otp")({
  component: VerifyOtpPage,
});
