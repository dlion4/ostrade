import { Link } from "@tanstack/react-router";
import { ArrowLeft, Hammer } from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import css from "@/styles/pages/stub.css?inline";

/** Designed placeholder for pages that open in a later build step. Never a 404, never blank. */
export function StubPage({ code, title, blurb }: { code: string; title: string; blurb: string }) {
  usePageStyle("stub", css);
  return (
    <main className="page-stub">
      <div className="container">
        <div className="os-stub-card">
          <span className="os-stub-icon" aria-hidden>
            <Hammer size={24} />
          </span>
          <span className="os-stub-code os-mono">{code}</span>
          <h1 className="h2 mb-2">{title}</h1>
          <p className="text-secondary mb-4">{blurb}</p>
          <p className="small text-secondary mb-4">This page opens in a later build step.</p>
          <div className="d-flex flex-wrap gap-2 justify-content-center">
            <Link to="/" className="os-btn os-btn-primary">
              <ArrowLeft size={16} aria-hidden /> Back to home
            </Link>
            <Link to="/how-it-works" className="os-btn os-btn-ghost">How it works</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
