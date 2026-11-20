import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

export const Route = createFileRoute("/home/status")({
  component: () => (
    <StubPage
      code="OPS"
      title="System status"
      blurb="Sign-in, broker adapter and scheduler health in one read-only panel."
    />
  ),
});
