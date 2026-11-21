import { createFileRoute, useParams } from "@tanstack/react-router";
import { StubPage } from "@/pages/home/Stub";

const LEGAL: Record<string, { title: string; blurb: string }> = {
  privacy: {
    title: "Privacy policy",
    blurb: "How OStrade handles your data and encrypted broker credentials.",
  },
  terms: {
    title: "Terms of service",
    blurb: "The rules for using OStrade.",
  },
  risk: {
    title: "Risk disclosure",
    blurb: "Trading involves a high risk of loss. Read this before going live.",
  },
};

export const Route = createFileRoute("/_marketing/legal/$doc")({
  component: LegalStub,
});

function LegalStub() {
  const params = useParams({ strict: false });
  const doc = LEGAL[params.doc ?? ""] ?? LEGAL.risk;
  return <StubPage code="LEGAL" title={doc.title} blurb={doc.blurb} />;
}
