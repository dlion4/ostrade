import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, X, Zap } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "./Toast";

export function Logo() {
  return (
    <Link to="/" className="os-logo" aria-label="OStrade home">
      <span className="os-logo-mark" aria-hidden>
        <Zap size={19} strokeWidth={2.4} />
      </span>
      OStrade
    </Link>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const close = () => setOpen(false);

  const onTheme = () => {
    toggle();
    toast(theme === "light" ? "Dark theme on" : "Light theme on");
  };

  return (
    <header className="os-nav">
      <div className="container">
        <div className="os-nav-inner">
          <Logo />
          <nav className="os-nav-links" aria-label="Primary">
            <Link to="/brokers" className="os-nav-link" activeProps={{ className: "os-nav-link active" }}>
              Brokers
            </Link>
            <Link to="/how-it-works" className="os-nav-link" activeProps={{ className: "os-nav-link active" }}>
              How it works
            </Link>
            <Link to="/dashboard" className="os-nav-link" activeProps={{ className: "os-nav-link active" }}>
              Dashboard
            </Link>
          </nav>
          <div className="os-nav-actions">
            <button
              type="button"
              className="os-icon-btn"
              onClick={onTheme}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link to="/auth/signin" className="os-btn os-btn-text os-btn-sm os-hide-sm">
              Login
            </Link>
            <Link to="/auth/signup" className="os-btn os-btn-primary os-btn-sm os-hide-sm">
              Sign Up
            </Link>
            <button
              type="button"
              className="os-icon-btn os-nav-toggle"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="os-mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="os-mobile-menu" className="os-nav-mobile" aria-label="Mobile">
            <Link to="/brokers" className="os-nav-link" onClick={close}>Brokers</Link>
            <Link to="/how-it-works" className="os-nav-link" onClick={close}>How it works</Link>
            <Link to="/dashboard" className="os-nav-link" onClick={close}>Dashboard</Link>
            <Link to="/auth/signin" className="os-nav-link" onClick={close}>Login</Link>
            <Link to="/auth/signup" className="os-btn os-btn-primary mt-2" onClick={close}>Sign Up</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
