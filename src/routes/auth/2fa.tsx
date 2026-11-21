import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorPage } from "@/pages/auth/AuthTwoFactor";

export const Route = createFileRoute("/auth/2fa")({
  component: TwoFactorPage,
});
