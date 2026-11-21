import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/pages/auth/AuthForgotPassword";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
});
