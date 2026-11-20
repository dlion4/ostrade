import { Link } from "@tanstack/react-router";
import { Mail, ShieldAlert } from "lucide-react";
import { Logo } from "./MarketingNav";

export function MarketingFooter() {
  return (
    <footer className="os-footer">
      <div className="container py-5">
        <div className="row g-4 g-lg-5">
          <div className="col-12 col-lg-5">
            <Logo />
            <p className="text-secondary mt-3 mb-3" style={{ maxWidth: 380 }}>
              A signal-trading command center. Paste a signal, review the order card, execute on Paper, Deriv or Exness/MT5.
            </p>
            <p className="small text-secondary mb-1">OStrade · Nairobi, Kenya</p>
            <a className="small d-inline-flex align-items-center gap-2 text-decoration-none" href="mailto:hello@ostrade.app">
              <Mail size={15} aria-hidden /> hello@ostrade.app
            </a>
          </div>
          <div className="col-6 col-md-4 col-lg-2 offset-lg-1">
            <h6>Product</h6>
            <Link to="/brokers" className="os-flink">Brokers</Link>
            <Link to="/how-it-works" className="os-flink">How it works</Link>
            <Link to="/auth/broker-connect" className="os-flink">Connect a broker</Link>
          </div>
          <div className="col-6 col-md-4 col-lg-2">
            <h6>Account</h6>
            <Link to="/auth/signin" className="os-flink">Login</Link>
            <Link to="/auth/signup" className="os-flink">Sign Up</Link>
          </div>
          <div className="col-12 col-md-4 col-lg-2">
            <h6>Legal</h6>
            <Link to="/legal/$doc" params={{ doc: "privacy" }} className="os-flink">Privacy</Link>
            <Link to="/legal/$doc" params={{ doc: "terms" }} className="os-flink">Terms</Link>
            <Link to="/legal/$doc" params={{ doc: "risk" }} className="os-flink">Risk Disclosure</Link>
          </div>
        </div>
        <div className="os-risk-note d-flex gap-3 mt-5" role="note">
          <ShieldAlert size={20} className="flex-shrink-0 mt-1" aria-hidden />
          <p className="mb-0">
            <strong>Risk disclosure.</strong> Trading forex, CFDs, synthetic indices and crypto involves a high risk of loss and is
            not suitable for everyone. You can lose more than you deposit. OStrade is execution and organisation software,
            not investment advice, and never holds your funds. Past performance does not guarantee future results. Practise on a
            paper account first.
          </p>
        </div>
        <p className="small text-secondary mt-4 mb-0">© 2025 OStrade. All rights reserved.</p>
      </div>
    </footer>
  );
}
