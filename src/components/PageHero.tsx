import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Uniform intro artwork: warm gradient chart motif shared by every workspace page hero. */
function HeroArtwork() {
  return (
    <svg className="os-hero-art" viewBox="0 0 540 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="os-hero-grid" width="29" height="29" patternUnits="userSpaceOnUse">
          <path d="M0 29V0H29" fill="none" stroke="currentColor" strokeOpacity=".18" />
        </pattern>
        <linearGradient id="os-hero-fill" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".19" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="540" height="240" fill="url(#os-hero-grid)" />
      <path d="M0 212 49 195 73 203 109 177 140 180 175 153 203 166 232 132 267 140 297 108 328 115 364 74 394 83 420 48 450 56 476 29 504 34 540 0V240H0Z" fill="url(#os-hero-fill)" />
      <path d="M0 212 49 195 73 203 109 177 140 180 175 153 203 166 232 132 267 140 297 108 328 115 364 74 394 83 420 48 450 56 476 29 504 34 540 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeOpacity=".74" />
      <path d="M0 232 55 218 82 226 119 202 147 210 184 186 219 191 253 164 288 174 318 151 353 155 389 125 423 129 449 102 482 107 510 85 540 92" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 6" strokeOpacity=".58" />
      {[[175, 153], [297, 108], [364, 74], [420, 48], [476, 29]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="4.4" fill="var(--sd-white)" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/**
 * Shared workspace page hero — same banner style as Records (T-8) and Broker
 * Hub (T-9): eyebrow kicker, large display title with accent span, lead, meta
 * pills, and right-aligned actions over the warm chart gradient.
 */
export function PageHero({
  icon: Icon,
  kicker,
  titleId,
  title,
  lead,
  meta,
  actions,
}: {
  icon: LucideIcon;
  kicker: string;
  titleId: string;
  title: ReactNode;
  lead: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="os-hero" aria-labelledby={titleId}>
      <HeroArtwork />
      <div className="os-hero-content">
        <div className="os-hero-kicker">
          <span><Icon size={14} aria-hidden /></span> {kicker}
        </div>
        <h1 id={titleId}>{title}</h1>
        <p>{lead}</p>
        {meta && <div className="os-hero-meta">{meta}</div>}
      </div>
      {actions && <div className="os-hero-actions">{actions}</div>}
    </header>
  );
}
