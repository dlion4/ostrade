import { createFileRoute } from "@tanstack/react-router";
import { OnboardPage } from "@/pages/auth/AuthOnboard";

export const Route = createFileRoute("/auth/onboard")({
  component: OnboardPage,
});
