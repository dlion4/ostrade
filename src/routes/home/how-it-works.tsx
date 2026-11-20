import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/pages/home/HowItWorks";

export const Route = createFileRoute("/home/how-it-works")({
  component: HowItWorksPage,
});
