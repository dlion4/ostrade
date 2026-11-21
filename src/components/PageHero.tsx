import type { ReactNode } from "react";
import {
  Bot,
  CalendarClock,
  Cable,
  CandlestickChart,
  Check,
  FlaskConical,
  Layers,
  LayoutGrid,
  ListOrdered,
  RadioTower,
  ShieldCheck,
  Ticket,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Dashed broker-flow wire behind every hero composition (deposits-style). */
function ArtWire() {
  return (
    <svg className="os-hero-art-wire" viewBox="0 0 300 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M8 128H84Q96 128 96 116V86M124 80H212Q224 80 224 68V32M152 122H238Q250 122 250 110V96" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 6" strokeOpacity=".55" />
      <circle cx="10" cy="128" r="4" fill="currentColor" />
      <circle cx="226" cy="30" r="5" fill="currentColor" />
      <circle cx="252" cy="94" r="4" fill="currentColor" />
    </svg>
  );
}

function CheckChip() {
  return <i className="os-hero-art-check"><Check size={9} /></i>;
}

/**
 * Unique right-side composition per workspace page — same design language as
 * the Deposits hero (dashed wire + tilted status card + floating chip), with
 * page-specific content instead of a shared motif.
 */
const HERO_ART: Record<HeroArtKey, ReactNode> = {
  markets: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><CandlestickChart size={13} /> Market watch</span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">EURUSD</span><span className="os-hero-art-mono os-hero-art-val">1.0843</span><span className="os-hero-art-tick is-up"><TrendingUp size={10} /> +0.12%</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">XAUUSD</span><span className="os-hero-art-mono os-hero-art-val">2385.50</span><span className="os-hero-art-tick is-down"><TrendingDown size={10} /> 0.41%</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">BTCUSDT</span><span className="os-hero-art-mono os-hero-art-val">64120</span><span className="os-hero-art-tick is-up"><TrendingUp size={10} /> +0.62%</span></span>
      </div>
      <span className="os-hero-art-float"><LayoutGrid size={13} /> 6 venues · one desk</span>
    </>
  ),
  trade: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><Ticket size={13} /> Order ticket</span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">XAUUSD</span><span className="os-hero-art-tick is-up os-hero-art-val">BUY</span><span className="os-hero-art-mono">0.10 lots</span></span>
        <span className="os-hero-art-row"><CheckChip /> Signal parsed · R:R 1 : 2.2</span>
        <span className="os-hero-art-row"><CheckChip /> Guardrails passed</span>
      </div>
      <span className="os-hero-art-float"><FlaskConical size={13} /> Paper · OST-2025-00123</span>
    </>
  ),
  signals: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><RadioTower size={13} /> Signal in · Gold Desk VIP</span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">XAUUSD BUY 2385.50</span></span>
        <span className="os-hero-art-row"><span className="os-hero-art-mono">SL 2378.00 · TP 2402.00</span></span>
        <span className="os-hero-art-row"><CheckChip /> Parsed · ready to review</span>
      </div>
      <span className="os-hero-art-float"><Cable size={13} /> Paste → review</span>
    </>
  ),
  automation: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><Bot size={13} /> Rule engine</span>
        <span className="os-hero-art-row"><span>Max lots / trade</span><span className="os-mono os-hero-art-strong os-hero-art-val">2</span></span>
        <span className="os-hero-art-row"><span>Daily loss lock</span><span className="os-mono os-hero-art-strong os-hero-art-val">5%</span></span>
        <span className="os-hero-art-row"><CheckChip /> Auto-pause armed</span>
      </div>
      <span className="os-hero-art-float"><ShieldCheck size={13} /> Kill-switch ready</span>
    </>
  ),
  scheduler: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><CalendarClock size={13} /> Today's queue</span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">09:15</span><span className="os-hero-art-mono os-hero-art-val">EURUSD BUY</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">11:30</span><span className="os-hero-art-mono os-hero-art-val">XAUUSD SELL</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">14:00</span><span className="os-hero-art-mono os-hero-art-val">US30 BUY</span></span>
      </div>
      <span className="os-hero-art-float"><Timer size={13} /> 8 of 50 slots</span>
    </>
  ),
  positions: (
    <>
      <div className="os-hero-art-panel">
        <span className="os-hero-art-panel-head"><ListOrdered size={13} /> Open positions</span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">EURUSD</span><span className="os-hero-art-mono">0.10</span><span className="os-hero-art-pl is-up os-hero-art-val">+86.40</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">XAUUSD</span><span className="os-hero-art-mono">0.05</span><span className="os-hero-art-pl is-down os-hero-art-val">−24.10</span></span>
        <span className="os-hero-art-row"><span className="os-mono os-hero-art-strong">BTCUSDT</span><span className="os-hero-art-mono">0.02</span><span className="os-hero-art-pl is-up os-hero-art-val">+154.02</span></span>
      </div>
      <span className="os-hero-art-float"><Layers size={13} /> One book · all brokers</span>
    </>
  ),
};

export type HeroArtKey = "markets" | "trade" | "signals" | "automation" | "scheduler" | "positions";

/**
 * Shared workspace page hero — compact deposits-style banner: eyebrow kicker,
 * display title with accent span, lead, meta pills, right-aligned actions and
 * a large page-unique artwork composition on the right.
 */
export function PageHero({
  icon: Icon,
  art,
  kicker,
  titleId,
  title,
  lead,
  meta,
  actions,
}: {
  icon: LucideIcon;
  /** Page-unique artwork composition shown large on the right. */
  art?: HeroArtKey;
  kicker: string;
  titleId: string;
  title: ReactNode;
  lead: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={`os-hero${art ? ` os-hero-art--${art}` : ""}`} aria-labelledby={titleId}>
      {art && (
        <div className="os-hero-art" aria-hidden="true">
          <ArtWire />
          {HERO_ART[art]}
        </div>
      )}
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
