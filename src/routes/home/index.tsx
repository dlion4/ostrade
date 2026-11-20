import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/home/Landing";

export const Route = createFileRoute("/home/")({
  component: LandingPage,
});
