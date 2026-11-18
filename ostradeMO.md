# OStrade — Multi-Broker Trading Command Center Outline
## One Platform · Many Brokers · Signals In · Trades Out · Fully Automatable
> A personal trading command center that plugs into every broker you can reach with an API — Deriv (WebSocket + OAuth), Exness and any MT4/MT5 broker via the MetaApi bridge, cTrader Open API, Alpaca (live + paper), Binance (live + testnet), OANDA (practice + live) — and unifies them into ONE dashboard: live markets, a multi-account trade ticket, a signal desk that turns pasted or streamed signals into real orders on your paper or live accounts, a signal-automation rules engine, a scheduler that can hold 20+ schedules at once, consolidated positions, full trade records, finance rails (deposit / withdraw / transfer where the broker APIs allow), an AI co-pilot, and a risk layer with a global kill switch.
>
> **Not a broker clone.** OStrade never re-implements Exness's or Deriv's dashboards. It is the unification layer on top: one quote stream, one order lifecycle, one ledger, one risk engine — across every connected account.
>
> **Revision 1 — TanStack Start + Bootstrap 5.3.x + page-scoped CSS + motion system.** One master trader dashboard (16 pages, 7+ sections each). Every route resolves to exactly one CSS file under `src/styles/pages/` — strict 1-to-1 page-to-stylesheet mapping, scoped isolation, zero style leakage.
>
> Design companion: `learnlyMO.md` shares the same document grammar (tokens, page blocks, 1-to-1 stylesheet mapping) but OStrade carries its own trading-terminal design system (dark-first, Space Grotesk / Inter / JetBrains Mono, tick-flash motion).

---

## TABLE OF CONTENTS

```
1.  PROJECT OVERVIEW & ARCHITECTURE
2.  GLOBAL STYLING SYSTEM  (trading-terminal palette + Bootstrap 5.3.x + page-scoped CSS)
3.  BROKER & API INTEGRATION MAP  (unified adapter + capability matrix + symbol normalization)
4.  HOME PAGES (3)
5.  AUTH & ONBOARDING PAGES (8) — incl. broker-connect wizard
6.  TRADER DASHBOARD PAGES (16) — 7+ SECTIONS EACH
7.  SHARED COMPONENTS
8.  STATE MANAGEMENT
9.  DATABASE SCHEMA
10. SIGNAL ENGINE  (ingest → parse → stage → fan-out execute)
11. SCHEDULER ENGINE  (20+ schedules, cron / session / price / indicator triggers)
12. BROKER ADAPTER ENGINE  (health, reconnect, rate limits, reconciliation)
13. FINANCE ENGINE  (deposit / withdraw / transfer rails, double-entry ledger)
14. AI CO-PILOT ENGINE  (LLM + tools, one-click automations, anomaly monitor)
15. RISK & GUARDRAIL ENGINE  (pre-trade checks, kill switch, storm guards)
16. NOTIFICATIONS & COMMS  (in-app / email / SMS / push / Telegram)
17. COMPLETE PAGE INDEX
18. IMPLEMENTATION PHASES
```

---

## 1. PROJECT OVERVIEW & ARCHITECTURE

### 1.1 Tech Stack

```
FRONTEND (TanStack-first):
Framework:       TanStack Start  (server functions + file-based routing)
Router:          TanStack Router  (type-safe routes, loaders, search params,
                 code-split route components + assets)
Server State:    TanStack Query  (query keys, mutations, invalidation,
                 background refetch, optimistic updates)
Tables:          TanStack Table v8  (sorting, filtering, pagination,
                 column resizing, row selection, expandable rows)
UI Library:      Bootstrap 5.3.x (latest stable) + Bootstrap Icons
Custom CSS:      Page-scoped stylesheets — one per route, 1-to-1 file mapping
Forms:           React Hook Form + Zod  (schema reuse across client + server)
Charts:          TradingView Lightweight Charts (candles, depth) +
                 Recharts (KPI/mini charts, equity curves, P&L bars)
Realtime:        WebSocket multiplexer (broker ticks) + Socket.IO
                 (internal push: fills, alerts, schedule fires, AI actions)
Animation:       Framer Motion + CSS keyframes + Bootstrap collapse/tab transitions
Build:           Vite (TanStack Start default)

BACKEND (Node + Express):
Runtime:         Node.js 20 LTS + Express 4
Database:        PostgreSQL 16 (Prisma ORM)
Cache:           Redis 7 (quote cache, rate-limit tokens, sessions,
                 tick buffers, idempotency keys)
Auth:            Auth.js (credentials) + JWT refresh + TOTP 2FA
Queue:           BullMQ (order execution, scheduler ticks, signal
                 fan-out, reconciliation, AI jobs, notification fanout)
WebSocket:       ws 8.x (Deriv WS multiplexer) + MetaApi WS client +
                 Binance/Alpaca/cTrader WS clients
Broker Bridges:  @deriv/api-client (WS), metaapi.cloud SDK (MT4/MT5 bridge —
                 covers Exness + any MT broker), ctrader-open-api SDK,
                 @alpacahq/alpaca-trade-api, binance connector, oanda v20 REST
File Storage:    S3-compatible (statement exports, journal screenshots,
                 proof-of-deposit uploads)
Mailer:          React Email + Resend (transactional)
SMS/Push:        Africa's Talking (SMS, Kenya-first) + Web Push
AI:              LLM provider (tool-calling) + signal-parser model +
                 anomaly detection service (self-hosted rules first, ML later)

INFRASTRUCTURE:
Hosting:         VPS or AWS ECS (Fargate) behind Cloudflare
Container:       Docker + docker-compose (dev) / ECS task def (prod)
CI/CD:           GitHub Actions (type-check → test → build → deploy)
Monitoring:      Prometheus + Grafana + Sentry
Logging:         Winston → Loki → Grafana
CDN:             Cloudflare (static assets, cache, WAF)
Secrets:         Vault / AWS Secrets Manager — broker credentials encrypted
                 at rest (AES-256-GCM), never logged, masked in every UI
Timezone:        Africa/Nairobi (EAT, UTC+3) default — all session clocks,
                 cron expressions, and day-rollovers are EAT-native
```

### 1.2 High-Level Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                CLIENT (TanStack Start + Vite)                          │
│  ┌──────┐ ┌──────┐ ┌────────────────────────────────────────────────┐ │
│  │ Home │ │ Auth │ │ TRADER DASHBOARD (16 routes, page-scoped CSS)   │ │
│  │route │ │route │ │ T-1 Command · T-2 Markets · T-3 Ticket ·        │ │
│  │.css  │ │.css  │ │ T-4 Signals · T-5 Automation · T-6 Scheduler ·  │ │
│  └──────┘ └──────┘ │ T-7 Positions · T-8 Records · T-9 Accounts ·    │ │
│                    │ T-10 Deposits · T-11 Withdrawals · T-12 Ledger · │
│                    │ T-13 Copilot · T-14 Risk · T-15 Notifications ·  │
│                    │ T-16 Settings                                    │ │
│                    └───────────────────────┬────────────────────────────┘ │
└────────────────────────────────────────────┼──────────────────────────────┘
                                             │ HTTPS / WSS
┌────────────────────────────────────────────▼──────────────────────────┐
│                    API GATEWAY (Express)                               │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Auth     │ │ Market    │ │ Order     │ │ Signal   │ │ Finance   │ │
│  │ OTP/JWT  │ │ Data API  │ │ API       │ │ API      │ │ API       │ │
│  │ 2FA      │ │ quotes/   │ │ ticket/   │ │ ingest/  │ │ dep/wd/   │ │
│  │ sessions │ │ symbols   │ │ modify/   │ │ parse/   │ │ transfer/ │ │
│  │          │ │ charts    │ │ close     │ │ rules    │ │ ledger    │ │
│  └──────────┘ └───────────┘ └───────────┘ └──────────┘ └───────────┘ │
└─────┬──────────────┬──────────────┬──────────────┬─────────────┬────┘
      │              │              │              │             │
┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼────────┐ ┌───▼───────┐ ┌───▼────────┐
│PostgreSQL │ │  Redis 7    │ │ BullMQ       │ │ BROKER    │ │ AI SERVICE │
│(accounts, │ │ (quote cache│ │ (execution,  │ │ ADAPTER   │ │ (LLM tools,│
│ orders,   │ │  rate limits│ │  scheduler,  │ │ LAYER     │ │  parsing,  │
│ signals,  │ │  idempotency│ │  reconciliation│ │───────   │ │  anomalies)│
│ ledger,   │ │  tick bufs) │ │  AI jobs)    │ │ see §3    │ └────────────┘
│ schedules)│ └─────────────┘ └──────────────┘ └───┬───────┘
└───────────┘                                      │
                                    ┌──────────────▼──────────────────┐
                                    │        BROKERS (per §3)         │
                                    │ Deriv WS  · Exness/MT5 MetaApi  │
                                    │ cTrader    · Alpaca (paper+live)│
                                    │ Binance (live+testnet) · OANDA  │
                                    └─────────────────────────────────┘
```

### 1.3 Key Architecture Principle

```
OS MODEL (operator = trader = master admin):

I (the trader) → connect MY broker accounts (Deriv, Exness/MT5, Alpaca,
                 Binance, OANDA, cTrader — live AND demo/paper)
               → every broker is normalized behind ONE adapter interface:
                  quotes · orders · positions · history · finance ops
               → I trade manually from ONE ticket to ANY account,
                 or to SEVERAL accounts at once
               → I paste or stream SIGNALS (Telegram, TradingView webhooks,
                 copy-trade exports) → parser → stage → click EXECUTE →
                 the order lands on my paper account or my Exness account,
                 whichever I chose
               → I AUTOMATE: signal rules (IF source X THEN execute on
                 account Y with size Z + guards) and SCHEDULES (up to 50
                 at once — cron, session windows, price triggers,
                 indicator triggers)
               → I do FINANCE inside the same platform: deposits,
                 withdrawals, transfers — executed through the broker
                 API wherever the provider allows it, tracked in a
                 double-entry ledger everywhere
               → RISK layer wraps EVERYTHING: pre-trade checks,
                 storm guards, fat-finger guards, global kill switch

TRADER DASH = my command center. There is no separate "admin" account:
              the trader IS the master admin (single-operator model).
              Absolute control over every page configuration, every
              automation, every rupee — limited only by what each
              broker's API actually permits (see §3 capability matrix).

WHAT OSTRADE IS NOT:
✗ Not a clone of Exness Terminal / Deriv Trader / MT5.
✗ Not a custodial exchange — funds live at the broker; OStrade holds
  ONLY API credentials and its own ledger of movements.
✗ Not a signal seller — OStrade consumes signals from anywhere
  (paste, Telegram, webhook, copy-trade export) and executes them.
```

### 1.4 UI Framework & Styling System (Expanded)

```
BOOTSTRAP 5.3.x RESPONSIVE BASE:
Grid:             container / row / col-* with sm-md-lg-xl-xxl breakpoints
Components:       card, table, modal, offcanvas, accordion, toast,
                  dropdown, nav-tabs, progress, badge, navbar,
                  collapse, scrollspy, tab, popover, tooltip, stepper
Utilities:        spacing (m-*, p-*, gap-*), flex (d-flex, gap-*),
                  display (d-none, d-md-block), rounded-4, shadow-*,
                  text-bg-*, opacity-*, ratio
Breakpoints:      sm 576px / md 768px / lg 992px / xl 1200px / xxl 1400px
Dark mode:        data-bs-theme="dark" DEFAULT (trading terminal-first);
                  light theme available; persists in localStorage
Form controls:    form-control, form-select, input-group, form-check,
                  floating labels, validation states (is-valid/is-invalid)
Offcanvas:        right-side detail drawers (position detail, signal
                  detail, broker health) via offcanvas-end on mobile
No jQuery — Bootstrap JS bundle imported per route (only when needed)

PAGE-SCOPED CUSTOM CSS (1-to-1 FILE MAPPING):
Convention:       one stylesheet per page/route — 27 pages → 27 stylesheets
File location:    src/styles/pages/<route>.css
e.g. /dashboard/signals   → src/styles/pages/dash-signal-desk.css
e.g. /dashboard/accounts  → src/styles/pages/dash-accounts.css
Namespacing:      every selector scoped under .page-<route> root class
                 .page-dash-command-center { … }
                 .page-dash-scheduler { … }
Layer order:      1) Bootstrap 5.3 (CDN/compiled)
                 2) Global design tokens (src/styles/tokens.css)
                 3) Shared component CSS (src/styles/components/*.css)
                 4) Page-scoped stylesheet (mounted at route enter)
Injection lifecycle:
                 TanStack Router createFileRoute() loader →
                 inject <link> into <head> →
                 on route leave: remove the <link> + clear cached styles
                 Guarantees no style leaks across pages.
Hot-reload:       Vite HMR wires the page stylesheet to its route component.

ANIMATION SYSTEM (trading-terminal grade):
Page entrance:    fade + slide-up stagger (60ms per item, capped at 12 items)
Micro-interact:   hover-lift + shadow on cards; spin/pulse on live icons
Data motion:      number count-up on KPI cards (1.2s ease-out, tabular-nums);
                 chart draw-in 600ms on load
TICK FLASH (signature): .os-flash-up / .os-flash-down — 500ms green/red
                 background flash on any live price change (quotes,
                 positions, order fills); coalesced so bursts render
                 as ONE flash per 300ms window
ROW FLASH:        .os-flash-filled (green 800ms) / .os-flash-failed
                 (red 800ms) / .os-flash-modified (amber 800ms) on order
                 and position rows when broker state changes
LIVE DOTS:        .os-pulse on every live indicator (tick stream,
                 adapter health, connection status); .os-spin on sync icons
MARQUEE:          market ticker strip on Command Center + Markets —
                 continuous scroll, pauses on hover, static under
                 prefers-reduced-motion
A11y:             prefers-reduced-motion → disable count-up (snap),
                 tick-flash (static highlight), marquee, draw-ins,
                 spin/pulse; keep only opacity transitions

RESPONSIVE CARD & SECTION SYSTEM:
KPI rows:          row-cols-1 row-cols-md-2 row-cols-xl-4  → 1/2/4 column flow
Card grids:        row-cols-1 row-cols-sm-2 row-cols-lg-3  → 1/2/3 flow
Tables-to-cards:   on < md breakpoint, tables collapse to stacked card layout
                  using data-label attributes (CSS ::before content)
Sidebar:           fixed on xl+; offcanvas on < xl with backdrop
Top bar:           sticky; global account-context switcher + kill-switch
                  button always visible in the top bar
Form layout:       vertical stack on sm, horizontal label on md+
Drawer panels:     slide-in from right on lg+, full-screen modal on sm
Chart panels:      full-width on < lg; 2-up grid on lg+; TradingView
                  Lightweight Charts resize observer on container
```

---

## 2. GLOBAL STYLING SYSTEM

> Single source of truth for OStrade's design tokens, motion tokens, and page-scoped CSS lifecycle. If a sibling file (e.g. `ostradeAdminMO.md`) ever appears, it MUST inherit this section verbatim.

### 2.1 Design Tokens

```
COLOR TOKENS (CSS custom properties on :root + [data-bs-theme="light"]):

/* Brand — OS Orange + Quote Cyan (terminal-first, dark by default) */
--brand-primary:        #f97316;   /* OStrade orange */
--brand-primary-rgb:   249, 115, 22;
--brand-accent:        #22d3ee;   /* quote cyan (live prices, charts) */
--brand-accent-rgb:   34, 211, 238;
--brand-success:       #22c55e;   /* profit green / fills */
--brand-danger:        #ef4444;   /* loss red / rejects */
--brand-warning:       #f59e0b;   /* guardrail amber */
--brand-info:          #38bdf8;   /* info blue */
--brand-purple:        #a855f7;   /* AI co-pilot violet */

/* Semantic surface tokens (dark-first; flip in light mode) */
--surface-0:           #0b0f1a;   /* page bg (dark, default) → #f8fafc (light) */
--surface-1:           #121828;   /* card bg (dark) → #ffffff (light) */
--surface-2:           #1a2236;   /* nested bg (dark) → #f1f5f9 (light) */
--surface-3:           #24304a;   /* hover/active bg (dark) → #e2e8f0 (light) */
--border-subtle:       rgba(148, 163, 184, 0.14);
--border-strong:       rgba(148, 163, 184, 0.28);

/* Text */
--text-primary:        #e6edf7;   /* → #0f172a (light) */
--text-secondary:      #94a3b8;
--text-tertiary:       #64748b;
--text-on-brand:       #0b0f1a;   /* dark text on orange buttons */
--text-up:             #22c55e;   /* bullish */
--text-down:           #ef4444;   /* bearish */

/* Broker badge palette (account & broker badges everywhere) */
--broker-deriv:        #ff4d6d;   /* Deriv */
--broker-exness:       #fbbf24;   /* Exness / MT5 via MetaApi */
--broker-metaapi:      #4d9eff;   /* MetaApi bridge (MT4/MT5 generic) */
--broker-ctrader:      #23a5f2;   /* cTrader */
--broker-alpaca:       #2dd4bf;   /* Alpaca (stocks, paper) */
--broker-binance:      #fcd535;   /* Binance */
--broker-oanda:        #818cf8;   /* OANDA */
--broker-paper:        #94a3b8;   /* demo/paper accounts (slate) */

/* Signal-source palette (attribution badges) */
--src-telegram:        #2aabee;   /* Telegram bot / forwarded signals */
--src-webhook:         #a855f7;   /* TradingView / custom webhooks */
--src-paste:           #94a3b8;   /* manual paste */
--src-copyfactory:     #4d9eff;   /* MetaApi CopyFactory */
--src-csv:             #38bdf8;   /* file upload */
--src-email:           #f59e0b;   /* forwarded email */

/* Schedule-trigger palette (scheduler badges) */
--trg-onetime:         #38bdf8;
--trg-cron:            #a855f7;
--trg-interval:        #22d3ee;
--trg-session:         #f97316;
--trg-price:           #22c55e;
--trg-indicator:       #fbbf24;

/* Data viz palette (charts) */
--viz-1: #22d3ee;  --viz-2: #f97316;  --viz-3: #22c55e;
--viz-4: #ef4444;  --viz-5: #a855f7;  --viz-6: #fcd535;

SPACING / RADIUS / SHADOW TOKENS:
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 24px;  --space-6: 32px;  --space-7: 48px;  --space-8: 64px;
--radius-sm: 8px;   --radius-md: 12px;   --radius-lg: 18px;
--radius-pill: 999px;
--shadow-1: 0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.20);
--shadow-2: 0 4px 12px rgba(0,0,0,0.35);
--shadow-3: 0 12px 32px rgba(0,0,0,0.45);
--shadow-lift: 0 18px 48px rgba(249,115,22,0.22);
--glow-up:   0 0 0 1px rgba(34,197,94,0.5), 0 0 12px rgba(34,197,94,0.25);
--glow-down: 0 0 0 1px rgba(239,68,68,0.5), 0 0 12px rgba(239,68,68,0.25);

TYPOGRAPHY TOKENS:
--font-display:  "Space Grotesk", "Inter", system-ui, sans-serif; /* headings */
--font-sans:     "Inter", "Noto Sans", system-ui, -apple-system, sans-serif;
--font-mono:     "JetBrains Mono", "SFMono-Regular", Menlo, monospace; /* prices */
--font-numeric:  "JetBrains Mono", tabular-nums;  /* ALL prices, P&L, sizes */
--fs-display:    3rem;
--fs-h1: 2.25rem;  --fs-h2: 1.75rem;  --fs-h3: 1.375rem;
--fs-kpi-xl:     2.5rem;  --fs-kpi:    1.75rem;  --fs-kpi-sm: 1.25rem;
--fs-tick:       0.9375rem;  /* live prices, mono, tabular */
--fs-body:       0.9375rem;  --fs-sm: 0.8125rem;
--fs-label:      0.6875rem; (uppercase, letter-spacing 0.08em, weighted 600)
--lh-tight: 1.15;  --lh-normal: 1.5;  --lh-relaxed: 1.65;
/* Rule: EVERY number a trader acts on (price, P&L, size, margin, %) renders
   in --font-numeric so columns align and flashes don't jitter. */

MOTION TOKENS:
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
--dur-instant:  80ms;   --dur-fast: 160ms;    --dur-base: 240ms;
--dur-slow:    400ms;   --dur-slower: 600ms;
--flash-up-bg:   rgba(34,197,94,0.16);
--flash-down-bg: rgba(239,68,68,0.16);
--flash-dur:     500ms;
--stagger-step: 60ms;   /* between staggered items, capped at 12 items */

Z-INDEX LAYERS:
--z-base:       1;
--z-sticky:     1020;   /* top bar */
--z-sidebar:    1030;
--z-dropdown:   1040;
--z-modal-bg:   1050;
--z-modal:      1060;
--z-toast:      1080;
--z-tooltip:    1090;
```

### 2.2 Page-Scoped CSS Injection Lifecycle

```
TanStack Router integration:

// src/routes/dashboard/signals.tsx
import { createFileRoute } from "@tanstack/router";
import signalsStyles from "@/styles/pages/dash-signal-desk.css";

export const Route = createFileRoute("/dashboard/signals")({
  // 1. Inject page stylesheet on enter
  loader: async ({ context }) => {
    context.styles.mount("dash-signal-desk", signalsStyles);
    return await context.queryClient.ensureQueryData(...);
  },
  // 2. Remove on leave
  onLeave: ({ context }) => {
    context.styles.unmount("dash-signal-desk");
  },
  // 3. Component scoped under .page-dash-signal-desk root class
  component: SignalDeskPage,
});

BEHAVIOR:
✓ Stylesheet is mounted exactly once when the route becomes active.
✓ Multiple instances of the same route (dev HMR) deduplicate via loader context.
✓ On route transition (leave), the <link> is removed from <head> and all
  .page-* scoped rules stop applying.
✓ Page components render a <div className="page-dash-<route>"> wrapper.
✓ Cross-page style leakage is structurally impossible.

MIGRATION SAFETY:
- Bootstrap utility classes still apply globally (intended).
- Shared component CSS (src/styles/components/*.css) loads at app root, so
  QuoteCell, OrderRow, BrokerBadge render identically on every page.
- Page stylesheets only override layout/visual specifics for that page.
```

### 2.3 Animation Patterns (Reusable Across All 27 Pages)

```
ENTRANCE PATTERNS:
.page-<route> > * { opacity: 0; transform: translateY(8px); }
.page-<route>.is-entered > * {
  animation: fadeSlideUp var(--dur-base) var(--ease-out) forwards;
  animation-delay: calc(var(--idx) * var(--stagger-step));
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

HOVER-LIFT CARDS:
.page-<route> .card.hover-lift {
  transition: transform var(--dur-fast) var(--ease-out),
              box-shadow var(--dur-fast) var(--ease-out);
}
.page-<route> .card.hover-lift:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lift);
}

COUNT-UP KPIs:
→ requestAnimationFrame animates from 0 to value over 1.2s
→ easing: easeOutQuart (1 - Math.pow(1 - t, 4))
→ currency/price formatted via kes()/usd() helper in tabular-nums
→ tab visibility lost: pause; resume on focus
→ prefers-reduced-motion: snap to final value immediately

TICK FLASH (signature OStrade pattern):
.os-quote[data-dir="up"]   { animation: flashUp var(--flash-dur) var(--ease-out); }
.os-quote[data-dir="down"] { animation: flashDown var(--flash-dur) var(--ease-out); }
@keyframes flashUp {
  0%   { background: var(--flash-up-bg); }
  100% { background: transparent; }
}
@keyframes flashDown {
  0%   { background: var(--flash-down-bg); }
  100% { background: transparent; }
}
→ Coalescing rule: a symbol may re-flash at most once per 300ms window
  (server batches tick deltas; client applies last-wins + flash)
→ Applied to: quote cells, position P&L cells, KPI deltas, chart last-price line

ROW FLASH ON BROKER STATE CHANGES:
.os-flash-filled    { animation: flashFilled 800ms var(--ease-out); }
.os-flash-failed    { animation: flashFailed 800ms var(--ease-out); }
.os-flash-modified  { animation: flashModified 800ms var(--ease-out); }
@keyframes flashFilled {
  0% { background: rgba(34,197,94,0.25); } 100% { background: transparent; } }
@keyframes flashFailed {
  0% { background: rgba(239,68,68,0.25); } 100% { background: transparent; } }
@keyframes flashModified {
  0% { background: rgba(245,158,11,0.25); } 100% { background: transparent; } }

ANIMATED ICONS:
.os-pulse { animation: pulse 1.4s var(--ease-in-out) infinite; }
.os-spin  { animation: spin 1.2s linear infinite; }
.os-draw  { stroke-dasharray: 1; stroke-dashoffset: 1;
            animation: draw 800ms var(--ease-out) forwards; }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; }
                   50%     { transform: scale(1.12); opacity: 0.7; } }
@keyframes spin  { to { transform: rotate(360deg); } }
@keyframes draw  { to { stroke-dashoffset: 0; } }

MARQUEE (ticker strip):
.os-ticker-track {
  display: inline-flex; gap: var(--space-5);
  animation: ticker 40s linear infinite;
}
.os-ticker:hover .os-ticker-track { animation-play-state: paused; }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
→ Content duplicated once for seamless loop; static (no animation)
  under prefers-reduced-motion.

CHART DRAW-IN:
.chart-draw { animation: chartDraw var(--dur-slower) var(--ease-out) forwards; }
@keyframes chartDraw {
  from { clip-path: inset(0 100% 0 0); opacity: 0; }
  to   { clip-path: inset(0 0 0 0);   opacity: 1; }
}

REDUCED MOTION:
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* count-up snaps to final; tick-flash becomes a static tint;
     row-flash skipped; marquee static; draw-ins skipped;
     spin/pulse disabled */
}
```

### 2.4 Responsive Card & Section Patterns

```
KPI ROW (1/2/4 column flow):
<div class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
  <div class="col"><StatCard …/></div> …
</div>

CARD GRID (1/2/3 flow with hover-lift):
<div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
  {items.map(p => <div class="col"><Card hover-lift …/></div>)}
</div>

TABLES-TO-CARDS (mobile auto-collapse):
@media (max-width: 767.98px) {
  .os-table-wrap thead { display: none; }
  .os-table-wrap tr {
    display: block; padding: var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md); margin-bottom: var(--space-2);
  }
  .os-table-wrap td {
    display: flex; justify-content: space-between;
    padding: var(--space-1) 0;
  }
  .os-table-wrap td::before {
    content: attr(data-label);
    font-weight: 600; color: var(--text-secondary);
    margin-right: var(--space-3);
  }
}

OFFCANVAS MOBILE SIDEBAR:
<nav class="navbar d-xl-none">
  <button class="btn btn-outline-primary" data-bs-toggle="offcanvas"
          data-bs-target="#dashSidebar">☰ OStrade</button>
  <span class="badge text-bg-dark"><span class="os-pulse-dot"></span> EXNESS active</span>
  <button class="btn btn-danger btn-sm" data-bs-toggle="modal"
          data-bs-target="#killSwitchModal">KILL</button>
</nav>
/* on xl+: sidebar static d-xl-block; below: offcanvas with backdrop */

SECTION DIVIDERS:
.section-divider {
  display: flex; align-items: center; gap: var(--space-3);
  margin: var(--space-6) 0 var(--space-4);
}
.section-divider::before,
.section-divider::after {
  content: ""; flex: 1; height: 1px;
  background: var(--border-subtle);
}
.section-divider .pill {
  font-family: var(--font-display);
  font-size: var(--fs-h3);
  color: var(--brand-accent);
}
```

### 2.5 Page-Scoped Stylesheet Index (1-to-1 Mapping)

```
The platform has 27 pages. Each ships its own stylesheet under
src/styles/pages/<route>.css. Strict 1-to-1 page-to-stylesheet mapping.

HOME PAGES (3 stylesheets):
H-1  src/styles/pages/landing.css
H-2  src/styles/pages/brokers.css                (broker & capability explorer)
H-3  src/styles/pages/how-it-works.css           (signal → trade flow explainer)

AUTH & ONBOARDING PAGES (8 stylesheets):
A-1  src/styles/pages/auth-signup.css
A-2  src/styles/pages/auth-signin.css
A-3  src/styles/pages/auth-onboard.css           (profile + risk profile wizard)
A-4  src/styles/pages/auth-broker-connect.css    (first broker connection hub)
A-5  src/styles/pages/auth-forgot-password.css
A-6  src/styles/pages/auth-reset-password.css
A-7  src/styles/pages/auth-verify-otp.css
A-8  src/styles/pages/auth-2fa.css               (TOTP enrollment)

TRADER DASHBOARD (16 stylesheets):
T-1   src/styles/pages/dash-command-center.css
T-2   src/styles/pages/dash-markets.css
T-3   src/styles/pages/dash-trade-ticket.css
T-4   src/styles/pages/dash-signal-desk.css
T-5   src/styles/pages/dash-signal-automation.css
T-6   src/styles/pages/dash-scheduler.css
T-7   src/styles/pages/dash-positions.css
T-8   src/styles/pages/dash-records.css
T-9   src/styles/pages/dash-accounts.css
T-10  src/styles/pages/dash-deposits.css
T-11  src/styles/pages/dash-withdrawals.css
T-12  src/styles/pages/dash-transfers.css
T-13  src/styles/pages/dash-copilot.css
T-14  src/styles/pages/dash-risk.css
T-15  src/styles/pages/dash-notifications.css
T-16  src/styles/pages/dash-settings.css

SHARED LAYOUT STYLESHEET (always mounted):
src/styles/app-shell.css
(sidebar, sticky top bar with global account-context switcher + kill-switch
button, mobile offcanvas nav, theme toggle, page wrapper, ticker strip shell)

SHARED COMPONENT CSS (loaded at app root, NOT page-scoped):
src/styles/components/*.css — StatCard, BrokerBadge, AccountPill, QuoteCell,
PriceFlash, OrderRow, SignalCard, SourceBadge, TriggerBadge, RuleCard,
ScheduleCard, PositionRow, LedgerEntry, KillSwitchButton, SessionClock,
ChartWrapper, DataTable, EmptyState, Reveal, etc.

TOTAL: 27 page stylesheets + 1 app-shell + N shared components
= strict 1-to-1 page-to-stylesheet mapping
```

### 2.6 Page Style Block Template

```
Every page in sections 4-6 below carries this STYLE block at its intro:

STYLE RULES:
Page stylesheet:   src/styles/pages/<route>.css
Root class:        .page-<route>  (scoped under this root only)
Mount lifecycle:   TanStack Router loader → mount <link>; onLeave → unmount
Motion hooks:      fadeSlideUp stagger (60ms/item, max 12 items)
                  hover-lift on .card.hover-lift
                  count-up on KPI numbers (1.2s ease-out-quart, tabular-nums)
                  tick-flash on live quotes / P&L / deltas (300ms coalesce)
                  row-flash-filled/failed/modified on broker state changes
                  os-pulse on live indicators; os-spin on sync icons
                  marquee on ticker strips (Command Center, Markets)
                  chart-draw on data charts (600ms ease-out)
Responsive:        KPIs 1/2/4 cols (sm/md/xl)
                  card grids 1/2/3 cols (sm/lg)
                  tables collapse to stacked cards < md
                  sidebar offcanvas < xl, static xl+
                  drawers slide-in right on lg+, full-screen modal on sm
                  forms vertical < md, horizontal md+
Reduced motion:    count-up snaps; tick-flash → static tint; marquee static;
                  draw-ins skipped; pulse/spin disabled
```

---

## 3. BROKER & API INTEGRATION MAP

> This section is OStrade's core. Everything in the dashboard — quotes, tickets, signals, schedules, positions, records, finance — flows through the unified adapter described here.

### 3.1 Unified Broker Adapter Interface

```
Every broker integration implements the same TypeScript interface:

interface BrokerAdapter {
  // IDENTITY
  id(): BrokerId;                    // 'deriv' | 'exness_mt5' | 'ctrader'
                                     // | 'alpaca' | 'binance' | 'oanda'
  // LIFECYCLE
  connect(creds): Promise<Conn>;     // OAuth / token / login+server
  health(): AdapterHealth;           // latency, lastTickAge, reconnects,
                                     // rateLimitHeadroom, wsState
  disconnect(): Promise<void>;

  // MARKET DATA
  symbols(): Promise<SymbolSpec[]>;  // unified: canonical symbol, broker
                                     // symbol, pip size, min/max lot,
                                     // leverage, sessions, margin rate
  subscribeTicks(symbols, cb): Unsub;      // streaming quotes
  candles(symbol, tf, from): Promise<Candle[]>;

  // TRADING
  quote(symbol): Promise<Quote>;           // bid/ask/spread
  proposal(req): Promise<Proposal>;        // margin, payout (Deriv),
                                           // est. fill (MT5)
  placeOrder(req): Promise<Fill>;          // market
  placePending(req): Promise<PendingOrder>;// limit/stop
  modifyOrder(id, req): Promise<void>;
  cancelOrder(id): Promise<void>;
  modifyPosition(id, {sl, tp}): Promise<void>;
  closePosition(id, volume?): Promise<Fill>;   // volume? = partial close
  closeAll(filter?): Promise<Fill[]>;          // by symbol/side/account

  // STATE
  positions(): Promise<Position[]>;
  pendingOrders(): Promise<PendingOrder[]>;
  history(from, to): Promise<Trade[]>;     // unified trade record
  balanceStream(cb): Unsub;                // balance/equity/margin updates

  // FINANCE (OPTIONAL — capability-gated, see §3.3)
  capabilities(): BrokerCapabilities;      // what THIS broker allows
  deposit(req)?: Promise<FundTx>;          // only if capabilities.deposit
  withdraw(req)?: Promise<FundTx>;         // only if capabilities.withdraw
  transferBetween(req)?: Promise<FundTx>;  // internal transfers, if allowed
}

BrokerCapabilities = {
  marketOrders, pendingOrders, modifySlTp, partialClose,
  positionsStream, historyApi, internalTransfer,
  depositApi, withdrawApi, copyTrading, demoAccounts
}

DESIGN RULES:
✓ The dashboard NEVER imports a broker SDK directly — only adapters.
✓ Adding a broker = adding one adapter file + one row in the capability
  matrix + one badge token. No dashboard changes required.
✓ Every adapter reports capabilities; the UI hides (not disables) features
  the broker does not support. A broker without a deposit API shows the
  manual-rail flow instead — never a dead button.
✓ Idempotency: every order/finance call carries a client-generated
  idempotency key (UUID) — Redis SETNX dedupe, 10-min TTL.
```

### 3.2 Per-Broker Integration Details

```
────────────────────────────────────────────────────────────────────
DERIV (api.deriv.com) — full trading API + cashier:
CONNECTION:
  WS:       wss://ws.derivws.com/websockets/v3?app_id={APP_ID}
  OAuth:    https://oauth.deriv.com (redirect flow, scopes: read, trade,
            payments, admin; trading + payments needed for OStrade)
  Auth:     authorize {token} per session; auto-reconnect w/ backoff
            1s → 2s → 5s → 15s; ping every 30s
MARKET DATA:
  active_symbols, ticks (subscribe), ticks_history (OHLC),
  trading_times, website_status
TRADING:
  proposal → buy (Rise/Fall, Higher/Lower, Touch/No Touch, Digits,
  Over/Under, Multiplier, Accumulator), sell, sell_expired,
  proposal_open_contract (subscribe — live contract state)
PORTFOLIO / HISTORY:
  balance (subscribe), portfolio, statement, profit_table,
  transaction (subscribe)
FINANCE (API-native — OStrade automates these):
  transfer_between_accounts   → internal transfers (USD↔account currency,
                                between my Deriv accounts)
  cashier {action: deposit|withdraw} → hosted cashier URL (deep-link flow)
  paymentagent_list           → payment agents (Kenya: M-Pesa agents)
  paymentagent_transfer       → deposit via payment agent (M-Pesa rail)
  withdraw                    → withdrawal initiation (where permitted)
  deposit_via_paymentagent    → PA-initiated credit
ACCOUNT:
  account_settings, reality_check, self_exclusion
  → mapped to OStrade's session-limit + reality-check features (T-14)
SYMBOLS:
  R_10, R_25, R_50, R_75, R_100, 1HZ10V–1HZ50V (synthetics — 24/7),
  frxEURUSD, frxGBPUSD, frxUSDJPY, frxXAUUSD (gold), frxXAGUSD,
  cryBTCUSD, cryETHUSD, stock indices (DJI, SPX, NDX, DAX…)
CONTRACT TYPES SUPPORTED BY ADAPTER:
  CALL/PUT (Rise/Fall), barrier-based, touch, digit match/differ/
  even/odd, over/under, accumulator, multiplier
DURATIONS: ticks (1–10, synthetics), seconds (15–3600), minutes (1–60),
  hours (1–24), days (1–365)

────────────────────────────────────────────────────────────────────
EXNESS & ANY MT4/MT5 BROKER (via MetaApi bridge — metaapi.cloud):
WHY A BRIDGE:
  Exness (and most MT brokers) expose NO public retail trading REST API.
  Trading access is via the MT4/MT5 terminal protocol. MetaApi hosts
  cloud MT terminals and exposes a clean REST + WebSocket API over them —
  the industry-standard way to automate Exness/MT5 accounts.
CONNECTION (provisioning):
  POST /users/current/accounts  { login, password (trader), server,
  region }   e.g. server: "Exness-MT5Real8" / "Exness-MT5Trial8"
  (Trial = Exness demo). Deploy account → obtain streaming/TS connection.
TRADING (MetaApi SDK methods, mapped into the adapter):
  connection.deposit / withdraw            (not supported by MT — see FINANCE)
  connection.placeOrder        → market BUY/SELL {symbol, volume (lots),
                                 stopLoss, takeProfit, comment, idempotencyKey}
  connection.createLimitOrder / createStopOrder / createStopLimitOrder
  connection.modifyPosition    → {id, stopLoss, takeProfit}
  connection.modifyOrder       → pending order edit
  connection.closePosition     → {positionId, volume?}  (partial close OK)
  connection.closeBy           → close-by-opposite
  connection.getAccountInformation → balance, equity, margin, marginLevel,
                                 leverage, currency, serverTime
  connection.getPositions / getOrders / getHistoryOrdersByPosition
  connection.subscribeToMarketData / subscribeToAccountInformation
STREAMING:
  MetaApi WebSocket: real-time ticks, account info, position updates
COPY-TRADING:
  CopyFactory API (MetaApi add-on): strategy providers + copy subscribers
  → OStrade uses it for "copy from my MT strategy into another of my MT
  accounts" and for importing copy-trade provider signals
EXNESS SYMBOL SUFFIXES (mapping needed):
  EURUSDm, GBPUSDm, XAUUSDm, BTCUSDm …  ('m' = standard account suffix;
  'c' = raw; 'z' = zero; suffix varies per account type)
  → symbol_map table (§3.4) resolves canonical EURUSD → EURUSDm etc.
ACCOUNT TYPES: MT5 real, MT5 trial (demo), MT4 real/demo

────────────────────────────────────────────────────────────────────
cTRADER OPEN API (Spotware) — IC Markets, FTMO, and other cBots shops:
  OAuth2 authorization-code flow (client_id/secret from Open API hub)
  Protobuf messages over TCP/WS: ProtoOASymbolsListReq,
  ProtoOASubscribeSpotsReq, ProtoOANewOrderReq (market/limit/stop),
  ProtoOAAmendPositionSLTPReq, ProtoOAClosePositionReq,
  ProtoOAReconcileReq, spot events
  Demo servers available for paper trading
  Adapter maps the protobuf events into the unified interface.

────────────────────────────────────────────────────────────────────
ALPACA — US stocks + ETFs, first-class PAPER TRADING:
  REST: api.alpaca.markets (live) / paper-api.alpaca.markets (paper)
  Auth: header key id + secret (API keys from dashboard)
  Trading: POST /v2/orders (market/limit/stop/stop_limit, bracket
  orders with take_profit/stop_loss legs, extended_hours flag)
  GET /v2/positions, PATCH /v2/orders/{id}, DELETE /v2/orders/{id}
  WS stream: trade_updates (fills), account_updates
  PERFECT PAPER MODE: OStrade defaults signal-desk "paper first" flow
  to an Alpaca paper account or Deriv demo account.

────────────────────────────────────────────────────────────────────
BINANCE — crypto spot + futures, live + testnet:
  REST: api.binance.com (spot) / fapi.binance.com (futures)
  Testnet: testnet.binance.vision (spot paper), testnet.binancefuture.com
  Auth: HMAC-signed requests with API key/secret (+ IP whitelist)
  Trading: POST /api/v3/order (MARKET/LIMIT/STOP_LOSS_LIMIT/OCO),
  GET /api/v3/openOrders, DELETE /api/v3/order, GET /account
  Finance: universal transfer (SAPI /sapi/v1/asset/transfer —
  spot↔funding↔futures), deposit history, withdraw apply
  (SAPI /sapi/v1/capital/withdraw/apply — whitelisted addresses only)
  WS streams: @ticker, @kline, executionReport, outboundAccountPosition
  Paper mode = testnet keys (OStrade marks testnet accounts DEMO).

────────────────────────────────────────────────────────────────────
OANDA — forex/CFD, practice (paper) + live:
  REST v20: api-fxpractice.oanda.com (practice) / api-fxtrade.oanda.com
  Auth: bearer token
  Trading: POST /accounts/{id}/orders (MARKET/LIMIT/STOP, takeProfit/
  stopLoss onOrderFill), GET /accounts/{id}/positions,
  PUT /accounts/{id}/positions/{instrument}/close
  Pricing stream: GET /accounts/{id}/pricing/stream
  Note: positions are NET per instrument (not per-ticket) — the adapter
  synthesizes ticket-like records from trades for a unified UX.
```

### 3.3 Broker Capability Matrix (what the APIs actually allow)

> The dashboard renders features ONLY where the matrix says the broker supports them. This is the machine-readable contract behind "as much as the provider APIs allow."

```
CAPABILITY                  | DERIV | EXNESS/MT5 (MetaApi) | cTRADER | ALPACA | BINANCE | OANDA
----------------------------|-------|----------------------|---------|--------|---------|-------
Market data stream (WS)     |  ✓    |         ✓            |    ✓    |   ✓    |    ✓    |   ✓
Market orders               |  ✓*   |         ✓            |    ✓    |   ✓    |    ✓    |   ✓
Limit / Stop orders         |  ✓*   |         ✓            |    ✓    |   ✓    |    ✓    |   ✓
Modify SL/TP on position    |  ✗**  |         ✓            |    ✓    |   ✓*** |    ✓    |   ✓
Partial close               |  ✓**  |         ✓            |    ✓    |   ✓    |    ✓    |   ✓
Positions stream            |  ✓    |         ✓            |    ✓    |   ✓    |    ✓    |   ✗ (poll)
Account history API         |  ✓    |         ✓            |    ✓    |   ✓    |    ✓    |   ✓
Internal transfer (API)     |  ✓    |         ✗            |    ✗    |   ✗    |    ✓    |   ✗
Deposit via API             |  ✓****|         ✗            |    ✗    |   ✓(US)|   ✓(cryp)|  ✗
Withdraw via API            |  ✓****|         ✗            |    ✗    |   ✓(US)|   ✓(cryp)|  ✗
Copy-trading                |  ✗    | CopyFactory ✓        |  cCopy ✓|   ✗    |    ✗    |   ✗
Demo/paper accounts         |  ✓    | MT5 Trial ✓          |  demo ✓ | paper ✓| testnet✓|practice✓
24/7 markets (synthetics)   |  ✓    |         ✗            |    ✗    |   ✗    | crypto ✓|   ✗

*  Deriv: order = buy a CONTRACT (proposal → buy). Limits/stops expressed as
   contract parameters, not MT-style pending orders.
** Deriv: positions are contracts; modify = sell + re-buy; partial close
   = sell part of a multiplier/accumulator stake.
*** Alpaca: SL/TP set at order time (bracket) or via replace; position-level
    patch supported.
**** Deriv: cashier (hosted URL flow), paymentagent_transfer (M-Pesa agents,
     Kenya), withdraw (where account is eligible). OStrade automates the
     API parts and deep-links the hosted cashier where required.

FINANCE UI RULE:
  deposit/withdraw page renders THREE flows per broker:
  1. API flow        (matrix ✓): fully automated, in-app, receipt stored
  2. Deep-link flow  (Deriv cashier): platform generates the cashier link,
     tracks completion via balance delta + transaction stream
  3. Manual-rail flow(matrix ✗): OStrade ledger records the movement with
     proof upload (screenshot of broker receipt / tx hash), balance
     reconciliation confirms the credit — the LEDGER IS ALWAYS AUTOMATED
     even when the broker rail is manual.
```

### 3.4 Symbol Normalization & Mapping

```
OStrade trades in CANONICAL symbols; the adapter translates per broker.

CANONICAL → BROKER-SPECIFIC (examples):
| Canonical | Deriv      | Exness MT5 | Alpaca | Binance | OANDA   |
|-----------|------------|------------|--------|---------|---------|
| EURUSD    | frxEURUSD  | EURUSDm    | —      | —       | EUR_USD |
| GBPUSD    | frxGBPUSD  | GBPUSDm    | —      | —       | GBP_USD |
| XAUUSD    | frxXAUUSD  | XAUUSDm    | —      | PAXG/   | XAU_USD |
|           |            |            |        | GOLDUSDT|         |
| BTCUSD    | cryBTCUSD  | BTCUSDm    | —      | BTCUSDT | —       |
| BTCUSDT   | —          | BTCUSDz*   | —      | BTCUSDT | —       |
| AAPL      | —          | —          | AAPL   | —       | —       |
| US30      | DJI        | US30m      | —      | —       | US30USD |
| R_10      | R_10       | —          | —      | —       | —       |

* zero-spread account suffix; 'm' standard, 'c' raw — resolved per account.

symbol_map TABLE (DB):
  canonical · broker_id · broker_symbol · pip_position · contract_size ·
  min_volume · volume_step · max_leverage · trading_sessions · notes

RESOLUTION ORDER (per order):
  1. exact match on (account.broker, canonical)
  2. account-type-aware suffix (m/c/z for Exness)
  3. AI mapper fallback (T-13) — fuzzy match with confidence score;
     below 0.9 confidence the UI asks the trader to confirm once,
     then persists the mapping for that account
```

### 3.5 Webhooks & Callback URLs (inbound automation)

```
OSTRADE INBOUND WEBHOOKS ( trader-configurable, per-source secret):

POST /webhooks/tradingview/{secret}
  → accepts TradingView alert JSON:
    { "ticker": "EURUSD", "action": "buy", "price": 1.0842,
      "sl": 1.0800, "tp": 1.0900, "contracts": 0.1, "comment": "…" }
  → normalized into a signal (source=webhook, subsrc=tradingview)

POST /webhooks/generic/{secret}
  → accepts any JSON/text; parser (§10) extracts instrument/action/
    entry/SL/TP; unmatched → quarantined with reason (visible T-4)

POST /webhooks/copyfactory/{secret}
  → CopyFactory provider signal events

TELEGRAM BOT (@OStradeBot):
  /link <pairing-code>     → bind a chat as a signal source
  forward any message      → parsed as a signal (source=telegram)
  /status, /positions, /kill, /closeall   → remote control commands
  (deep-link actions — the trader CAN monitor & act from Telegram
   without opening the dashboard)

EMAIL INBOUND:
  forward-to address (e.g. signals@inbound.ostrade.app) — subject/body
  parsed as signal; attachments (statement PDFs) routed to T-8 imports

OUTBOUND WEBHOOKS (OStrade → trader systems):
  order.filled · order.failed · position.closed · schedule.fired ·
  rule.fired · guard.blocked · deposit.confirmed · withdraw.settled ·
  copilot.proposal · killswitch.engaged
  → POST to trader-configured URL with HMAC signature header
```

---

## 4. HOME PAGES (3 PAGES)

---

### PAGE H-1: Landing Page (`/`)

```
PURPOSE:
First impression. Convince a trader with signals and multiple broker
accounts that OStrade is the one command center to run them all.

STYLE RULES:
Page stylesheet:   src/styles/pages/landing.css
Root class:        .page-landing
Motion hooks:      hero fadeSlideUp stagger (4 items, 80ms)
                  hover-lift on feature cards
                  count-up on "12 brokers", "50 schedules", "1 click"
                  os-draw on hero illustration (signal → parser → orders
                  flow SVG)
                  live ticker strip (marquee, pauses on hover)
Responsive:        hero 2-col on lg, stacked on md
                  feature cards 3-col on lg, 1-col on sm

LAYOUT:
┌─────────────────────────────────────────────────────────────────┐
│  NAVBAR                                                          │
│  [Logo: OStrade]  [Brokers] [How it works] [Login] [Sign Up]   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  HERO SECTION                                                    │
│  "Your signals. Every broker. One click."                       │
│  "Paste a signal from Telegram, TradingView, or your copy-trade │
│   provider — execute it on your Deriv, Exness (MT5), Alpaca or  │
│   paper account. Automate it. Schedule it. Never babysit it."   │
│  [⚡ Connect a Broker →]  [📄 See the flow →]                  │
│  Live ticker strip: EURUSD 1.0842 ▲ | R_10 4532.11 ▲ |          │
│  BTCUSDT 64,120 ▼ | XAUUSDm 2385.50 ▲  (marquee)               │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  TRUST BAR                                                       │
│  "Deriv WebSocket API" | "Exness via MetaApi" | "Alpaca Paper" │
│  | "Binance Testnet" | "AES-256 credential vault"               │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  FEATURE CARDS (3)                                               │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │ 📥 Signal Desk    │ │ 🤖 Automation     │ │ 🔀 Broker Hub     ││
│  │ Paste/stream any  │ │ 20+ schedules,    │ │ Connect & switch ││
│  │ signal → execute  │ │ signal rules,     │ │ Deriv/Exness/MT5/││
│  │ to any account    │ │ AI co-pilot       │ │ Alpaca/paper     ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  SIGNAL-TO-TRADE STRIP (mini diagram)                            │
│  Signal in → Parser → Risk guard → Broker adapter → Fill receipt │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  CTA + FOOTER                                                    │
│  "Start paper. Go live when you're ready."                      │
│  Footer: OStrade · Nairobi, Kenya · hello@ostrade.app           │
│  Privacy | Terms | Risk Disclosure (trading involves risk)      │
└─────────────────────────────────────────────────────────────────┘

SECTIONS (5):
S1 — HERO (display heading, dual CTA, live ticker strip)
S2 — TRUST BAR (broker + security badges)
S3 — FEATURE CARDS (3, hover-lift: Signal Desk / Automation / Broker Hub)
S4 — SIGNAL-TO-TRADE STRIP (5-step horizontal flow, os-draw animation)
S5 — CTA + FOOTER (risk disclosure — mandatory for a trading product)
```

---

### PAGE H-2: Brokers & Capabilities (`/brokers`)

```
PURPOSE:
Public explainer of every broker OStrade can plug into and exactly what
each broker's API allows — honesty as a feature ("we can only do what
the broker permits, and we tell you precisely").

STYLE RULES:
Page stylesheet:   src/styles/pages/brokers.css
Root class:        .page-brokers
Motion hooks:      fadeSlideUp per broker card, os-draw on capability ✓

SECTIONS (5):
S1 — HEADER ("Every broker with an API. Exactly what they allow.")
S2 — BROKER CARDS GRID (6 cards: Deriv, Exness/MT5 (MetaApi), cTrader,
     Alpaca, Binance, OANDA) — each with badge color, account types
     (live/demo), asset classes, connection method (OAuth / token /
     MT5 login+server / API keys)
S3 — CAPABILITY MATRIX (the §3.3 table, public version) — sticky header,
     ✓/✗ chips, hover tooltips explaining each row
S4 — PAPER-FIRST PANEL ("Paper trade every strategy first": Deriv demo,
     MT5 Trial, Alpaca paper, Binance testnet, OANDA practice — one
     toggle flips the whole platform to paper mode)
S5 — CTA ("Connect your first broker — takes 2 minutes")
```

---

### PAGE H-3: How It Works (`/how-it-works`)

```
PURPOSE:
Explain the signal-to-trade lifecycle and the automation model.

STYLE RULES:
Page stylesheet:   src/styles/pages/how-it-works.css
Root class:        .page-how-it-works
Motion hooks:      fadeSlideUp stagger, os-draw on flowchart SVG

SECTIONS (5):
S1 — Hero subhead ("From signal to fill in under a second")
S2 — SIGNAL FLOW diagram (Ingest → Parse → Guard → Route → Execute →
     Record), with a realistic sample Telegram signal rendering live
     into a staged order card
S3 — AUTOMATION MODELS (3 cards: Signal rules · Schedules · AI co-pilot)
S4 — FINANCE FLOW (deposit/withdraw/transfer per capability matrix —
     automated vs deep-link vs manual-rail)
S5 — FAQ accordion (8 Q&As: is my money safe at the broker, which
     brokers need MT5 bridge, can I run 20 schedules, what happens on
     disconnect, paper vs live, Telegram control, ref parsing rules,
     risk guards)
```

---

## 5. AUTH & ONBOARDING PAGES (8 PAGES)

---

### PAGE A-1: Sign Up (`/auth/signup`)

```
PURPOSE:
Entry point for the trader (single-operator model — the first account
becomes the master admin of this OStrade instance).

STYLE RULES:
Page stylesheet:   src/styles/pages/auth-signup.css
Root class:        .page-auth-signup
Motion hooks:      fadeSlideUp, os-draw on logo
Responsive:        2-col on lg (terminal illustration | form), 1-col on sm

SECTIONS (5):
S1 — SPLIT LAYOUT
    Left: brand panel (dark terminal bg, orange accent, Space Grotesk
    heading "One desk. Every broker.", sample quote flash animation)
    Right: the signup form card
S2 — ACCOUNT BASICS FORM (React Hook Form + Zod)
    Fields: email (required), phone (optional, Kenyan +254 aware),
    password, confirm password, accept Terms checkbox, accept Risk
    Disclosure checkbox (MANDATORY — trading product)
    Validation: password ≥ 10 chars, ≥ 1 number, ≥ 1 symbol;
    phone regex ^\+254[17]\d{8}$
S3 — OTP PREVIEW ("We'll send a 6-digit OTP to verify your phone/email")
S4 — "PAPER FIRST" PLEDGE (info card — new users start with a demo/paper
    account suggestion before connecting live keys)
S5 — FOOTER LINKS (Sign in · Forgot password · Privacy · Risk Disclosure)
```

---

### PAGE A-2: Sign In (`/auth/signin`)

```
PURPOSE:
Login. Role-aware redirect (single role: trader → /dashboard).

SECTIONS (5):
S1 — Brand header
S2 — Sign-in form (email or phone, password, "remember me" 30d)
S3 — "Sign in with OTP instead" toggle (passwordless path)
S4 — 2FA challenge inline (if TOTP enabled) — 6-digit input,
    auto-advance between digits
S5 — Footer links (sign up, forgot password, status page)
```

---

### PAGE A-3: Onboarding Wizard (`/auth/onboard`)

```
PURPOSE:
3-step wizard: trader profile → risk profile → preferences. Runs BEFORE
the broker-connect page so the platform can pre-configure defaults.

STYLE RULES:
Page stylesheet:   src/styles/pages/auth-onboard.css
Root class:        .page-auth-onboard
Motion hooks:      fadeSlideUp per step, .stepper-h progress animation

SECTIONS (5):
S1 — STEPPER HEADER (3 steps: Profile · Risk Profile · Preferences)
S2 — PROFILE FORM
    Fields: display name, country (default Kenya), timezone
    (default Africa/Nairobi), base display currency (USD default;
    KES display conversion optional), experience level
    (Beginner / Intermediate / Advanced / Professional)
S3 — RISK PROFILE QUESTIONNAIRE (drives default guardrails)
    Questions: annual income band, trading experience years, max
    acceptable daily loss %, instruments intended (forex/synthetics/
    crypto/stocks), automation intent (manual / semi / full)
    → OUTPUT: suggested defaults for T-14 guardrails (max daily loss %,
    max positions, max stake per trade) — trader confirms or edits
S4 — PREFERENCES FORM
    Theme (dark default), density (comfortable/compact), number format,
    lots-vs-units preference, notification channels preview
    (in-app always; email/SMS/Telegram toggleable)
S5 — REVIEW & CONTINUE ("Next: connect your first broker →")
```

---

### PAGE A-4: Broker Connect (`/auth/broker-connect`)

```
PURPOSE:
THE distinctive auth page — connect the first broker account (or a
paper account) so the dashboard has data on first load. Supports every
adapter's native flow.

STYLE RULES:
Page stylesheet:   src/styles/pages/auth-broker-connect.css
Root class:        .page-auth-broker-connect
Motion hooks:      fadeSlideUp per broker card, os-pulse on connecting
                  states, count-up on "connect in ~2 min"

SECTIONS (5):
S1 — BROKER PICKER (6 broker cards + 1 "paper only" card)
    Each card: BrokerBadge, account types, connection method label,
    "what we can do there" chip row (trade ✓ · deposit API ✓/✗ ·
    transfer ✓/✗ — straight from the capability matrix)
S2 — DERIV OAUTH FLOW (inline, 5 steps rendered as a stepper)
    Step 1: register app note / redirect URI shown
    Step 2: redirect to oauth.deriv.com (state=CSRF)
    Step 3: user authorizes (scopes listed)
    Step 4: callback validation (code + acct1)
    Step 5: WS authorize → account list (real + demo) → pick default
S3 — EXNESS / MT5 VIA METAAPI FORM
    Fields: MT login (account number), MT password (trader password —
    investor password is read-only, blocked with hint), server dropdown
    (Exness-MT5Real1..12, Exness-MT5Trial1..12, or custom), MetaApi
    region (new-york / london / singapore), MetaApi token (or OStrade
    managed token), label ("Exness Live 1"), type (LIVE/DEMO radio)
    → Test connection (provision account → deploy → getAccountInformation
    → show balance + server + leverage as proof)
S4 — KEY-BASED BROKERS (compact forms)
    Alpaca: key id + secret + endpoint (paper default / live)
    Binance: API key + secret + IP-whitelist note + testnet toggle
    OANDA: token + environment (practice default / live) + account id
    cTrader: OAuth connect button
    Each with inline "Test" that fetches account info before saving
S5 — FIRST-ACCOUNT CONFIRMATION
    Summary card (broker, account id, type LIVE/DEMO badge, currency,
    balance) + security note (credentials encrypted AES-256-GCM,
    stored in vault, never logged) + "Enter dashboard →"
```

---

### PAGE A-5: Forgot Password (`/auth/forgot-password`)

```
SECTIONS (5):
S1 — Header ("Reset your password")
S2 — Identifier input (email or phone)
S3 — Send OTP button (rate-limited: 1 per 60s, 5 per hour)
S4 — "Try signing in instead" link
S5 — Footer / help block
```

---

### PAGE A-6: Reset Password (`/auth/reset-password`)

```
SECTIONS (5):
S1 — OTP 6-digit input (auto-advance)
S2 — New password + confirm (zxcvbn strength meter)
S3 — Reset button (invalidates all sessions + revokes broker WS tokens
    in memory; adapters reconnect with stored credentials)
S4 — Success state — auto-redirect to /auth/signin after 3s
S5 — Security note (all active sessions revoked)
```

---

### PAGE A-7: Verify OTP (`/auth/verify-otp`)

```
SECTIONS (5):
S1 — "Enter the 6-digit code sent to <masked identifier>"
S2 — 6-digit split input (auto-advance, paste-friendly)
S3 — Resend OTP (countdown 60s)
S4 — "I'm having trouble" link (status page + support)
S5 — Footer
```

---

### PAGE A-8: 2FA Enrollment (`/auth/2fa`)

```
PURPOSE:
TOTP enrollment — REQUIRED before connecting any LIVE broker account
(enforced gate: live-account connect flow redirects here if 2FA off).

SECTIONS (5):
S1 — QR code (otpauth:// URI) + manual secret entry fallback
S2 — Verify 6-digit TOTP (accepts ±1 window)
S3 — Recovery codes (10 codes, shown ONCE, download button, hash-stored)
S4 — Enforce toggle ("Require 2FA on every login" — default ON)
S5 — "Done → continue to broker connect" CTA
```

---

## 6. TRADER DASHBOARD PAGES (16 PAGES)

> The trader dashboard IS the master admin console — single-operator model, absolute control. Every page below has **7+ sections** with concrete fields, components and actions — no placeholders.

---

### PAGE T-1: Command Center (`/dashboard`)

```
PURPOSE:
The trader's cockpit. Everything that matters in one screen: portfolio
state across all brokers, live positions, automation status, alerts,
market clocks, and the kill switch one keystroke away.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-command-center.css
Root class:        .page-dash-command-center
Motion hooks:      fadeSlideUp stagger (12 items),
                  count-up on KPIs (tabular-nums),
                  tick-flash on equity + P&L deltas,
                  os-pulse on live indicators,
                  marquee ticker strip,
                  chart-draw on equity curve
Responsive:        KPIs 1/2/4, cards 1/2/3, tables collapse < md,
                  sidebar offcanvas < xl

LAYOUT:
┌─────────────────────────────────────────────────────────────────┐
│ TOP BAR (sticky): [☰] OStrade · [Account Context ▾] ·           │
│ [Session clocks] [🔔 5] [KILL SWITCH] [Profile ▾]               │
└─────────────────────────────────────────────────────────────────┘
┌───────────────┬─────────────────────────────────────────────────┐
│ SIDEBAR        │ MAIN                                             │
│ (xl static)    │ S1 STATUS RIBBON (adapter health chips)          │
│ 16 nav items   │ S2 KPI ROW (6 cards)                             │
│                │ S3 EQUITY CURVE + per-account sparklines         │
│                │ S4 LIVE POSITIONS SNAPSHOT (table, tick-flash)   │
│                │ S5 AUTOMATION BOARD (rules · schedules · AI)     │
│                │ S6 ALERTS & ACTION CENTER                        │
│                │ S7 MARKET CLOCK + ECONOMIC CALENDAR STRIP        │
└───────────────┴─────────────────────────────────────────────────┘

SECTIONS (7):

S1 — STATUS RIBBON (horizontal chip strip)
    Per connected adapter: BrokerBadge + WS state (● live green pulse /
    ● reconnecting amber / ● down red) + latency ms + last-tick age s +
    rate-limit headroom bar (mini). Click chip → T-9 health drawer.
    Far right: GLOBAL MODE badge (LIVE / PAPER) + kill-switch state
    (ARMED / PAUSED / FLATTENED).

S2 — KPI ROW (6 cards, count-up, tick-flash on deltas)
    • Aggregate equity (sum of all accounts, display currency)
    • Today's realized P&L (green/red, tick-flash)
    • Floating P&L (live, tick-flash per tick batch)
    • Open positions (count; sub-label: "across 4 accounts")
    • Margin usage % (worst account; amber >70%, red >85%)
    • Automation uptime % (24h — schedules+rules engines)

S3 — EQUITY CURVE PANEL
    Left (8 cols): aggregate equity curve (Recharts area, chart-draw),
    range tabs 1D / 1W / 1M / 3M / ALL; realized vs floating toggle;
    drawdown shading under curve.
    Right (4 cols): per-account sparkline list — each row: BrokerBadge +
    account label + mini equity sparkline + today % (tick-flash).

S4 — LIVE POSITIONS SNAPSHOT (top 8 by absolute P&L)
    Compact table: BrokerBadge · Account label · Symbol (canonical) ·
    Side (▲/▼) · Size · Entry · Current (tick-flash) · P&L (tick-flash) ·
    "Manage →" (→ T-7 detail drawer). Footer link: "All positions → T-7".

S5 — AUTOMATION BOARD (3 mini-panels side by side)
    • SCHEDULES: next 3 firings (time, symbol, action, account) +
      "T-6 →" + active count badge
    • SIGNAL RULES: top 3 active rules (name, source badge, fired today,
      last decision) + "T-5 →"
    • AI CO-PILOT: latest AI proposal (if any) with Approve/Dismiss
      inline + "T-13 →" (AI NEVER auto-executes without an approval
      setting — see §14)

S6 — ALERTS & ACTION CENTER
    Stacked alert cards (os-pulse on critical):
      • "Exness adapter reconnecting (3 attempts)" → T-9
      • "Margin level 62% on Exness Live 1" → T-7
      • "Kill switch triggered by daily-loss guard" → T-14
      • "Deposit confirmed: +$500 Deriv (tx RDX…)" → T-10
    Each dismissible (writes to alerts_ack); critical ones sticky until
    acknowledged.

S7 — MARKET CLOCK + ECONOMIC CALENDAR STRIP
    Left: 4 session clocks (Sydney / Tokyo / London / New York) with
    OPEN/CLOSED states in EAT, next-open countdowns.
    Right: next 5 high-impact economic events (NFP, FOMC, CPI, ECB —
    from an events feed), each with impact stars + countdown; clicking
    an event offers "Create guard schedule around event" (→ T-6 prefilled).
```

---

### PAGE T-2: Markets (`/dashboard/markets`)

```
PURPOSE:
Multi-broker market explorer — every tradable symbol from every
connected account, one quote stream, one chart, specs per broker.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-markets.css
Root class:        .page-dash-markets
Motion hooks:      tick-flash on all quote cells, chart-draw on candles,
                  os-pulse on streaming badge, marquee on hot-symbols strip

SECTIONS (7):

S1 — ACCOUNT CONTEXT BAR
    Global "active context" selector (this page + T-3/T-4 honor it):
    single account, multiple accounts, or ALL — plus LIVE/DEMO filter
    and broker multi-select. Shows resolved symbols count
    ("142 symbols across 5 accounts").

S2 — WATCHLIST GRID
    Editable watchlist (drag-order): quote cards — canonical symbol,
    broker-specific symbol caption, bid/ask (tick-flash, mono font),
    spread, day change %, mini sparkline (24H). Click card → chart
    focuses (S4). Add/remove via search (S3). Persisted per user.

S3 — MARKET EXPLORER (search + filter table)
    Full symbol universe across adapters. Columns: canonical symbol ·
    broker symbol(s) · asset class · broker(s) offering · min lot ·
    leverage · sessions · actions (Add to watchlist · Trade → T-3
    prefilled · Chart → S4). Filters: asset class chips (Forex /
    Synthetics / Metals / Indices / Crypto / Stocks), broker chips,
    tradeable-now toggle (session open), search box (fuzzy, canonical
    or broker symbol — "eurusdm" resolves to EURUSD).

S4 — CHART PANEL (TradingView Lightweight Charts)
    Candlestick + volume; symbol from watchlist/explorer selection;
    timeframes 1m/5m/15m/1H/4H/1D/1W; indicators: EMA20/50, RSI14,
    Bollinger (toggleable); live last-price line with tick-flash;
    drawing tools minimal (trend line, H-line); "Trade this from the
    ticket →" button (T-3 prefilled); broker overlay note when the
    selected account's broker differs from the chart's data source.

S5 — ASSET CLASS TABS PANEL
    Tab per asset class with a curated quote grid (top by volume /
    % change): Forex majors, Synthetics (R_10…1HZ50V — 24/7 badge),
    Metals, Indices, Crypto, Stocks. Each cell click → chart focus.
    Hot-symbols marquee above (biggest movers today, tick-flash).

S6 — SYMBOL DETAIL DRAWER (slide-in right)
    Per symbol+broker: full specs — contract size, pip/tick size,
    min/max/step volume, margin rate, leverage, swap long/short,
    sessions with EAT times, broker symbol + suffix note, last 20
    ticks table (mono), "Where can I trade this?" list (accounts with
    this symbol + spreads side-by-side), Trade / Schedule / Watch
    actions.

S7 — ECONOMIC CALENDAR PANEL
    Today + tomorrow high/medium impact events (time in EAT), affected
    symbols highlighting on the watchlist (amber dot), per-event
    actions: "Pause automation ±30min around this event" (creates a
    guard schedule → T-6), "Set price alert" (→ T-15).
```

---

### PAGE T-3: Trade Ticket (`/dashboard/trade`)

```
PURPOSE:
The one ticket that trades EVERY account. Build an order once — fire it
to one account or fan it out to many, with risk preview and Deriv-style
contract building for synthetics.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-trade-ticket.css
Root class:        .page-dash-trade-ticket
Motion hooks:      tick-flash on live quote + margin preview,
                  count-up on risk numbers, os-pulse on submitting state,
                  row-flash-filled/failed on receipts

SECTIONS (7):

S1 — ACCOUNT MULTI-SELECT
    Target accounts for this ticket: checkboxes per connected account
    (BrokerBadge + label + LIVE/DEMO chip + balance). "Select all live"
    / "Select all demo" quick buttons. Allocation mode: same size on
    each / scale by equity % / custom per account. Guardrail note when
    a LIVE account is selected while global mode is PAPER.

S2 — INSTRUMENT SELECTOR
    Canonical symbol search (S3 explorer data) + broker-symbol caption
    per selected account (shows "EURUSD → frxEURUSD (Deriv) /
    EURUSDm (Exness)" — mapping visible, never magic). Live quote panel:
    bid/ask/spread (tick-flash), session status per account, "symbol
    not available on account X" warnings.

S3 — ORDER BUILDER (MT-style instruments)
    Order type: Market / Limit / Stop / Stop-Limit.
    Side: BUY / SELL (big tactile buttons).
    Size: lots (0.01 step) or units; per-account size allocation editor.
    SL/TP modes: none · price · pips · % of entry · money (auto-converts
    per account). Bracket preview table per account (entry, SL, TP,
    R:R ratio). Comment field (max 32 chars, MT5-safe).
    Time-in-force: GTC / day / IOC (where supported — capability-gated).

S4 — RISK PREVIEW PANEL (updates live)
    Per selected account: required margin, resulting margin level %,
    exposure change (by asset class), stake as % of equity, spread cost
    estimate, swap estimate if held overnight. GUARDRAIL STRIP: passes
    T-14 pre-trade checks (green ✓ per rule) or violations listed in
    red with the exact guard that will block (e.g. "Max stake per trade
    $200 — requested $350 on Deriv Real").

S5 — DERIV CONTRACT BUILDER (synthetics & Deriv contracts)
    Shown when any selected account is Deriv:
    Contract type picker: Rise/Fall · Higher/Lower · Touch/No Touch ·
    Matches/Differs · Even/Odd · Over/Under · Multiplier · Accumulator.
    Duration: ticks (1–10) / seconds / minutes / hours / days.
    Stake per contract; multiplier: leverage slider (×100–×1000) +
    deal cancellation toggle; Accumulator: growth rate slider.
    LIVE PROPOSAL panel (proposal call, auto-refresh): payout, net P&L,
    barrier, spin during fetch.

S6 — CONFIRM & EXECUTE FLOW (receipt-grade)
    Sequence: summary modal (per-account order cards) → confirm (type
    "EXECUTE" if total stake > fat-finger threshold) → per-account
    parallel submission w/ spinner (BullMQ fan-out, idempotency keys) →
    RECEIPTS panel: one row per account — status (filled ✓ / rejected ✗
    / timeout ⚠), fill price, ticket/position id, broker message;
    row-flash per result; ONE toast at the end ("3 filled · 1 rejected —
    see receipts"). Retry-rejected button (rebuilds only failed legs).

S7 — RECENT TICKETS + QUICK-REPEAT
    Last 10 tickets: timestamp · symbol · side · size · accounts (mini
    badges) · result summary. Actions: Repeat (prefill builder) ·
    Reverse (flip side on same accounts) · Schedule this (→ T-6 prefilled).
    Keyboard: Ctrl+Enter submits ticket; Esc cancels confirm modal.
```

---

### PAGE T-4: Signal Desk (`/dashboard/signals`)

```
PURPOSE:
The signal inbox and execution console. Paste a Telegram signal, receive
a TradingView webhook, forward an email, import a copy-trade export —
parse it, review it, and click PLACE to send it to any account(s).

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-signal-desk.css
Root class:        .page-dash-signal-desk
Motion hooks:      fadeSlideUp on new signals (Socket.IO push),
                  row-flash-filled/failed on executions,
                  os-pulse on "listening" source chips

SECTIONS (7):

S1 — SOURCE STATUS STRIP
    Active ingestion channels with health: Paste console (always on) ·
    Telegram bot (@OStradeBot — linked chats count, os-pulse) ·
    Webhook URL (copy button + secret rotation) · Email forward
    (inbound address) · CSV import · CopyFactory provider link.
    Each chip: last-received-at + signals-today count.

S2 — PARSER CONSOLE (the paste box)
    Large textarea ("Paste anything a signal provider sends you") +
    LIVE PARSE preview as you type/drop:
    structured order card — instrument (canonical + per-account
    mapping), side, entry (market/limit), SL, TP, size hint, confidence
    score, ambiguity warnings ("no SL found — will use guardrail
    default?"), source auto-tag. Sample chips to try:
      "BUY XAUUSD @ 2385.50 SL 2378.00 TP 2395.00"
      "SELL EURUSD LIMIT 1.0850 SL 40p TP 80p lot 0.2"
      "R_10 RISE stake 5 USD ticks 5"
      "LONG BTCUSDT 64000 SL 62500 TP 68000"
    Grammar supports: BUY/SELL/LONG/SHORT, @price/LIMIT/STOP, SL/TP in
    price or pips, lot/volume/stake/size, ticks/duration, TP1/TP2/TP3
    (splits into scale-out legs), comments/emoji tolerated.

S3 — EXECUTION PANEL (stage → place)
    For the selected parsed signal(s) — multi-select from inbox:
    account multi-select (reuse T-3 S1 component), size mode: as-signal
    / fixed / % equity / scale-to-risk (normalize SL distance to X% of
    equity), SL/TP override (as-signal / scaled / none), max-spread
    check per account, confirmation modal (per-account order cards) →
    PLACE → receipts (same as T-3 S6). Buttons: Stage for later ·
    Place now · Discard · Edit before place.

S4 — SIGNAL HISTORY TABLE
    All signals, newest first. Columns: received · source (SourceBadge)
    · raw excerpt (truncated, expand) · instrument · side · entry ·
    SL/TP · status (received → parsed → staged → executed → filled /
    rejected / quarantined / expired) · accounts hit (badges) ·
    attributed P&L (fills linked) · actions (Re-execute · Schedule ·
    Journal note → T-8). Filters: source, status, instrument, date.

S5 — COPY-TRADE IMPORT PANEL
    Three importers:
    • MetaApi CopyFactory: link a provider strategy → stream its trades
      as signals (mapped through symbol_map)
    • MQL5 / broker statement export: upload HTML/CSV of a provider's
      history or live trades → convert to signals (deduped by ticket id)
    • Generic copy-platform export: paste rows → column mapper
    Imported items land in the inbox marked src-copyfactory / src-csv.

S6 — SOURCE PERFORMANCE LEADERBOARD
    Per source (Telegram channel, webhook key, provider): signals count,
    executed count, win rate, cumulative attributed P&L, avg slippage
    vs entry, quarantined count. Sortable; "mute source" action; this
    data drives which sources are worth auto-automating (→ T-5).

S7 — DEDUPE & STORM GUARD LOG
    Every parser-guard decision: duplicate signal (same instrument+side
    +entry within N minutes — configurable), storm quarantine (>N
    signals/min from one source), malformed (reason), stale (entry
    price > X% away from current quote). Each row: signal, guard,
    action taken, one-click override ("Execute anyway — I know").
    Overrides require the reason and are audit-logged (§15).
```

---

### PAGE T-5: Signal Automation Engine (`/dashboard/automation`)

```
PURPOSE:
Turn the Signal Desk from manual to autonomous. IF/THEN rules that
execute qualifying signals automatically — with hard risk guards and
a dry-run simulator so you trust a rule before it trades.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-signal-automation.css
Root class:        .page-dash-signal-automation
Motion hooks:      fadeSlideUp, os-pulse on rule "listening" states,
                  row-flash-filled/failed on rule fires

SECTIONS (7):

S1 — AUTOMATION KPI ROW (4 cards, count-up)
    Active rules · Signals processed today · Auto-executed today ·
    Blocked by guards today (+ blocked-last-7d sparkline).

S2 — RULES TABLE
    Each rule row: name · trigger source (SourceBadge) · condition
    summary ("symbol ∈ {EURUSD, XAUUSD} · side=BUY · session=London") ·
    action summary ("BUY 1% equity risk → Exness Live 1 + Deriv Real") ·
    status toggle (ON/OFF) · fired-today · last decision · actions
    (Edit · Duplicate · Dry-run · Delete-confirm). Up to 30 rules.

S3 — RULE BUILDER WIZARD (4-step Stepper)
    Step 1 TRIGGER: source pick (paste/telegram/webhook/copyfactory/
    email) + optional specific channel/key
    Step 2 CONDITIONS (chips, AND-composed): instrument ∈ watchlist/
    universe · direction (BUY/SELL/any) · has-SL (require / optional) ·
    has-TP · session window (London/NY/overlap/Asia/custom EAT range) ·
    confidence ≥ X% · provider ∈ list · max spread ≤ X · market open
    Step 3 ACTIONS: target account(s) + allocation mode; size mode:
    as-signal / fixed / % equity / risk-normalized (SL-distance → X%);
    SL/TP handling: as-signal / scaled ±% / guardrail-defaults / none;
    execution style: market immediate / limit at entry ± slippage
    Step 4 GUARDS & LIMITS: max trades/hour per rule · max open positions
    contribution · daily-loss circuit-breaker % · dedupe window ·
    quiet-hours override · kill-switch respects (always) → SAVE as
    draft or activate (dry-run first suggested)

S4 — CONDITION LIBRARY (reference + quick-insert)
    Every available condition with docs + example; toggle "advanced
    mode" for JSON condition editor (Zod-validated schema shown live).

S5 — ACTION MAPPING PREVIEW
    For the rule being built: a live simulation table — given the last
    20 signals from the chosen source, show WOULD-EXECUTE /
    WOULD-SKIP (+reason) per signal, with the exact orders that would
    have been created per account (size, SL, TP conversions visible).

S6 — SIMULATION / DRY-RUN MODE
    Run any rule against a date range (default last 30 days of real
    received signals): outcome report — would-have trades, hypothetical
    P&L at broker closes, guard hits, per-account allocation chart.
    "Promote to live" button (requires confirmation + audit entry).

S7 — RULE AUDIT LOG
    Every rule evaluation (fired or skipped): timestamp · rule · signal
    ref · decision (EXECUTED / SKIPPED:reason / BLOCKED:guard) · orders
    created (refs) · latency ingest→submit. Export CSV. This is the
    "why did my automation do that?" answer — always one click away.
```

---

### PAGE T-6: Trade Scheduler (`/dashboard/scheduler`)

```
PURPOSE:
Set-and-forget executions. Up to 50 concurrent schedules (20 at a go is
the design floor) — one-time, recurring, session-windowed, price-
triggered, indicator-triggered. Bulk-create 20 schedules in one paste.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-scheduler.css
Root class:        .page-dash-scheduler
Motion hooks:      fadeSlideUp, os-pulse on "armed" schedules,
                  count-up on KPIs, chart-draw on next-24h timeline

SECTIONS (7):

S1 — SCHEDULER KPI ROW (5 cards)
    Active schedules (n / 50) · Next firing (countdown, mono) ·
    Fired today · Success rate 7d · Failed 7d (+ retry depth).

S2 — CALENDAR VIEW
    Month/week grid (EAT timezone): each cell lists schedule dots
    (TriggerBadge color) with symbol + action; click dot → schedule
    drawer (S4 view mode); drag-to-reschedule for one_time items;
    week view shows hourly slots; session shading (London/NY bands).

S3 — SCHEDULES TABLE (the 20-at-a-go workspace)
    Columns: name · trigger (TriggerBadge: one_time / cron / interval /
    session / price / indicator + human summary e.g. "every 15m during
    London") · accounts (badges) · instrument · action+size · SL/TP ·
    status (armed / paused / completed / failed / expired) · next fire ·
    last result · actions (Pause/Resume · Run now · Edit · Duplicate ·
    Delete-confirm). Bulk select → enable/disable/delete. Sort/filter
    by trigger, account, instrument, status. CAP: 50 (config flag
    MAX_SCHEDULES, default 50 — UI shows "20 at a go supported; cap 50").

S4 — SCHEDULE BUILDER (drawer wizard)
    Fields per trigger type:
    • one_time: fire-at datetime (EAT picker)
    • cron: expression + EAT preview of next 5 runs
    • interval: every N minutes/hours + start/stop window
    • session: London open / NY open / London-NY overlap / Asia /
      custom range — action at open, close, or interval-within-session
    • price: symbol + condition (crosses above/below X, % move since
      open, spread < Y) + action
    • indicator: RSI < 30 / EMA cross / ATR spike (evaluated on the
      platform's candle cache; timeframe selectable)
    Common: account(s) + size mode (fixed / % equity) + order params
    (reuse T-3 builder component, incl. Deriv contract mode) + expiry
    (never / at-date / after N skips) + max consecutive failures
    (auto-pause after N) + label + tags.

S5 — BULK PASTE BUILDER (the 20-at-a-go power tool)
    Paste lines like:
      "R_10 RISE 5usd ticks 3 every 15min london"
      "EURUSD BUY 0.1 SL 20p TP 40p at NY-open"
      "XAUUSD SELL 0.2 if crosses_below 2380"
    → parser maps each line to a schedule (same grammar as §10 signal
    parser + schedule clauses) → PREVIEW TABLE (20 rows, per-row errors
    highlighted inline) → fix or drop rows → CREATE ALL (single BullMQ
    batch; ref OS-SCH-XXXX per schedule) → ONE toast.

S6 — NEXT-24H FIRING TIMELINE
    Horizontal timeline (chart-draw): scheduled fires plotted on an
    EAT hour axis with symbol + direction arrows; price-trigger and
    indicator schedules shown as "waiting for condition" lanes with
    current condition distance ("RSI 34 → trigger < 30"); hover →
    mini details; click → drawer.

S7 — EXECUTION LOG PER SCHEDULE
    Per schedule: fire history table — fired-at · condition snapshot ·
    order ref · broker response (filled / rejected / timeout) · retry
    count · P&L attribution (when closed). Plus schedule-level stats:
    fired/missed/skipped, avg latency, failure pattern note. Export CSV.
```

---

### PAGE T-7: Positions & Orders (`/dashboard/positions`)

```
PURPOSE:
One consolidated book: every open position and pending order across
every broker, with full management powers — modify SL/TP, partial
close, reverse, bulk actions — where the API allows.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-positions.css
Root class:        .page-dash-positions
Motion hooks:      tick-flash on P&L + price cells (coalesced),
                  row-flash-filled/failed/modified on broker updates,
                  os-pulse on streaming badge, count-up on KPIs

SECTIONS (7):

S1 — PORTFOLIO KPI ROW (5 cards, tick-flash)
    Open positions · Floating P&L · Today realized P&L · Margin level
    (worst account) · Exposure by asset class (mini stacked bar).

S2 — CONSOLIDATED POSITIONS TABLE (all brokers, one grid)
    Columns: BrokerBadge · account label · canonical symbol (broker
    symbol caption) · side ▲/▼ · size · entry · current (tick-flash) ·
    SL · TP · swap · floating P&L (tick-flash, colored) · age ·
    source tag (manual ticket / signal ref / schedule ref / AI) ·
    row actions (Detail · Modify SL/TP · Partial close · Reverse ·
    Close). Sort by P&L/age/symbol; filter by broker, account, asset
    class, source, direction; search; sticky header; LIVE/DEMO filter.
    Multi-select rows → bulk bar (S5).

S3 — PENDING ORDERS TABLE
    Limit/stop/stop-limit orders across brokers: symbol · side · type ·
    size · trigger price · current distance (tick-flash) · SL/TP ·
    expiry · actions (Modify · Cancel). Deriv pending equivalents shown
    as staged contract proposals awaiting buy (if any).

S4 — POSITION DETAIL DRAWER (slide-in right)
    Tabs:
    • Overview: full order lifecycle (created → submitted → filled →
      modifications), broker ids (MT ticket / Deriv contract id /
      exchange order id), latency, idempotency key
    • Chart: symbol candle chart with entry/SL/TP lines (Lightweight
      Charts price-lines)
    • Modify: SL/TP editor (price/pips/money modes — capability-gated;
      Deriv shows "not supported: close & re-open" guidance instead of
      a dead control), partial-close volume editor (MT5 lots, Alpaca
      qty, Binance base-asset), reverse (close + opposite entry preview)
    • Attribution: created by (ticket ref / signal ref / schedule ref /
      AI proposal ref) with deep-link
    • Journal: notes + tags (syncs T-8 journal)

S5 — BULK ACTIONS BAR (appears on row selection)
    Close selected · Close all losing > $X · Close all by symbol ·
    Close all by direction · Move SL to breakeven (+p buffer) ·
    Trail SL (ATR/pips/fixed — where supported) · Scale-out 50%.
    Each bulk op → confirm modal listing exactly which positions
    (per broker) will be touched + expected volume → execute with
    per-row receipts (row-flash). Deriv contracts in the selection are
    handled as sell-contract ops with a capability note.

S6 — DERIV OPEN CONTRACTS PANEL
    Dedicated panel when Deriv accounts are connected: live
    proposal_open_contract stream per contract — current tick vs
    barrier (Rise/Fall), digit state (Digits), multiplier P&L +
    deal-cancellation window countdown, accumulator growth-rate path.
    Actions: Sell now (contract) / Sell at profit target / let expire.
    This gives Deriv the same "position management" feel as MT5.

S7 — MARGIN & EXPOSURE MONITOR
    Per account: margin level bar (green ≥ 200% / amber 100–200% /
    red < 100%), equity vs balance delta (floating), leverage in use,
    top exposure rows (symbol, notional, % of equity), broker
    margin-call threshold markers. Warnings feed the alert engine
    (→ T-15) at 80% / 50% / 20% levels (configurable).
```

---

### PAGE T-8: Trade Records & Analytics (`/dashboard/records`)

```
PURPOSE:
The system of record. Every fill from every broker, unified, attributed
(manual / signal / schedule / AI), analyzed, reconciled against broker
statements, and exportable (CSV/XLSX/PDF/KRA-ready).

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-records.css
Root class:        .page-dash-records
Motion hooks:      fadeSlideUp, count-up on KPIs, chart-draw on charts,
                  os-spin on import/reconcile jobs

SECTIONS (7):

S1 — RECORDS KPI ROW (6 cards, count-up)
    Total trades · Win rate · Profit factor · Avg R multiple ·
    Best day · Worst day. Range selector applies to all (1W/1M/3M/
    YTD/ALL).

S2 — UNIFIED TRADE HISTORY TABLE
    Every closed trade across brokers. Columns: closed-at (EAT) ·
    BrokerBadge · account · canonical symbol · side · size · entry →
    exit · SL/TP (as set) · gross P&L · commission/swap · net P&L ·
    R multiple · duration · source attribution (manual/signal X/
    schedule Y/AI Z — deep-links to the source record) · journal-note
    indicator. Filters: date range, broker, account, symbol, source,
    win/loss, min/max P&L. Sticky header; column chooser; CSV/XLSX
    export of current view. Row click → trade detail drawer
    (lifecycle, fills, ledger entries, journal).

S3 — ANALYTICS CHARTS (2×2 grid, chart-draw)
    • Equity curve (portfolio + per-account toggle)
    • Daily net P&L bars (green/red, hover = day detail)
    • Win/loss distribution (histogram of R multiples)
    • By-symbol heat table (net P&L per symbol per month)

S4 — ATTRIBUTION ANALYTICS ("what's actually making money?")
    P&L and win-rate breakdowns by: signal source (Telegram channel /
    webhook key / provider), automation rule, schedule, manual ticket,
    AI action. Bar + donut charts, sortable league table, and a
    verdict chip per source (KEEP / MONITOR / MUTE suggestion based on
    profit factor + sample size). Deep-links to mute (→ T-5) or pause
    schedule (→ T-6).

S5 — STATEMENT RECONCILIATION
    Import broker statements (MT5 HTML report, Deriv statement CSV,
    Binance trade history XLSX, Alpaca activity CSV, OANDA transaction
    history): importer maps columns → diff engine compares broker
    records vs internal ledger → EXCEPTIONS table (missing trade,
    P&L mismatch > tolerance, duplicate detection, swap/commission
    deltas) → resolve actions (accept broker value / keep internal /
    flag for review). Reconciliation status badge per account
    (SYNCED / DRIFT n / STALE > 7d).

S6 — EXPORT CENTER
    Queue-based exports (BullMQ): full history CSV/XLSX · filtered
    subset · PDF monthly summary (equity chart + stats + top trades) ·
    KRA-ready tax export (realized P&L per year, per account, in KES
    at NBE daily rates where conversion needed) · API JSON dump.
    Each job: status, size, download link, email/SMS on completion.

S7 — TRADE JOURNAL
    Per-trade and per-day notes: markdown-lite editor, tags
    (setup/mistake/emotion), screenshots upload (S3), link to signal or
    schedule. Journal list with filters; "lesson of the week" digest
    option (emails weekly summary of tagged mistakes). Journal entries
    surface inside T-7 position drawers and here.
```

---

### PAGE T-9: Accounts & Broker Hub (`/dashboard/accounts`)

```
PURPOSE:
Connect, health-check, configure, and SWITCH brokers. The control room
for the adapter layer — where "I use Exness" or "paper today" is just
a context switch, and every account's true capabilities are visible.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-accounts.css
Root class:        .page-dash-accounts
Motion hooks:      os-pulse on health dots, fadeSlideUp per account card,
                  count-up on aggregate balance

SECTIONS (7):

S1 — CONNECTED ACCOUNTS GRID
    Card per trading account: BrokerBadge · label · LIVE/DEMO chip
    (LIVE = orange border, DEMO = slate) · currency · balance · equity
    (tick-flash) · today P&L · margin level bar · adapter health dot ·
    capabilities chip row (trade ✓ · modify ✓ · deposit-API ✓/✗ ·
    transfer ✓/✗). Click → detail drawer (S5). "Connect account" card
    opens the wizard (S2).

S2 — ADD BROKER WIZARD (same flows as A-4, dashboard-grade)
    Broker picker → native flow per broker (Deriv OAuth / MetaApi MT
    login+server / Alpaca keys / Binance keys / OANDA token / cTrader
    OAuth) → test connection (live balance proof) → 2FA gate if LIVE →
    save (credentials to vault) → first sync (symbols, positions,
    history backfill). Progress feedback at every step (os-spin).

S3 — ADAPTER HEALTH & DIAGNOSTICS
    Table per adapter instance: WS state · latency (p50/p95, mono) ·
    last tick age · reconnect count 24h · rate-limit headroom (per
    endpoint budget bars) · last error (truncated, expandable) ·
    actions (Reconnect · Refresh symbols · Run diagnostics). Diagnostics
    run a read-only probe suite (auth ✓, ticks ✓, positions ✓, clock
    skew ms) and render a pass/fail checklist.

S4 — ACTIVE CONTEXT SWITCHER
    Sets the platform-wide "active context" honored by T-2/T-3/T-4:
    default account, multi-select set for ticket fan-out, and global
    mode LIVE vs PAPER (one toggle that (a) swaps ticket defaults to
    demo accounts, (b) arms a confirm overlay on any LIVE action).
    Switching persists per user; the top bar always shows current
    context ( AccountPill ).

S5 — ACCOUNT DETAIL DRAWER
    Tabs: Overview (identity, server, leverage, permissions granted) ·
    Symbols (resolved symbol_map rows for this account, editable suffix
    override) · Health (adapter diagnostics scoped to this account) ·
    Finance (capability summary + last deposits/withdrawals/transfers) ·
    History sync (last backfill, coverage range, re-sync button) ·
    Audit (connect/disconnect/permission events).

S6 — SYMBOL MAPPING TABLE
    Global canonical ↔ broker mapping with per-account overrides:
    canonical · broker · broker symbol · pip size · volume step ·
    min/max volume · sessions. Editable rows (admin-of-self), AI-mapper
    suggestions (confidence shown) with one-click accept; unmapped
    symbols flagged. This table is what makes a signal that says
    "XAUUSD" fill correctly on Exness as XAUUSDm.

S7 — ACCOUNT AUDIT LOG
    Every account-level event: connected · credentials rotated ·
    permissions changed · reconnected (with cause) · disconnected ·
    sync jobs · health incidents. Filter by account/adapter/event;
    export CSV. Ties into the global audit trail (§9 audit_trail).
```

---

### PAGE T-10: Deposits (`/dashboard/deposits`)

```
PURPOSE:
Fund any account through whatever rail the broker allows — fully
automated (Deriv payment agent M-Pesa, Binance crypto), deep-linked
(Deriv cashier), or manual-rail with ledger proof (Exness). The ledger
is always automated even when the rail is manual.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-deposits.css
Root class:        .page-dash-deposits
Motion hooks:      os-pulse on pending deposits, count-up on KPIs,
                  row-flash-filled on confirmed credits

SECTIONS (7):

S1 — DEPOSITS KPI ROW (5 cards)
    Deposited this month (display currency) · Pending count ·
    Confirmed today · Failed 7d · Avg confirm time per rail.

S2 — RAIL MATRIX PANEL
    Per account, the available rails with status chips — straight from
    capabilities: Deriv → paymentagent (M-Pesa, Kenya agents listed) /
    cashier deep-link / crypto; Exness MT5 → manual-rail (bank / M-Pesa
    to Exness-approved processors / crypto via Exness — proof upload);
    Binance → crypto address (auto-gen) / internal; Alpaca → ACH (US
    banks) / manual wire; OANDA → manual. Each rail row: fee note,
    min/max, ETA. Click rail → builder (S3).

S3 — DEPOSIT BUILDER (drawer)
    Steps: account → rail → amount (+ display-currency conversion at
    daily rate) → rail-specific fields → review (fees, ETA, reference)
    → submit. Rail-specific fields:
    • paymentagent: agent picker (nearest by country=Kenya, shows
      agent name/max per tx/currency) + phone confirm
    • crypto: network pick (TRC20 cheapest / ERC20 / BEP20) → generated
      address + QR + "send exactly X USDT" copy row + confirmations
      tracker (0/1/…/19) → auto-credit on webhook
    • manual: proof upload (screenshot/PDF, ≤10MB) + broker reference +
      expected credit amount → admin-of-self confirms after verifying
      balance delta (ledger pending → confirmed)
    All flows write the same finance_transactions record with
    idempotency key.

S4 — DERIV CASHIER INTEGRATION PANEL
    For Deriv accounts: cashier {action:deposit} → hosted URL button
    (opens modal/iframe), transaction stream watches for the credit
    (balance subscribe + transaction events) → auto-matches amount
    within window → marks confirmed (receipt stored). paymentagent_list
    renders Kenya M-Pesa agents inline (name, min/max, currency) and
    paymentagent_transfer executes the deposit directly in-app.

S5 — CRYPTO DEPOSIT INSTRUCTIONS PANEL
    Address book per network with whitelist confirmation (first use →
    email+OTP verify), reusable addresses (Binance) vs per-deposit
    (where provider mints unique), QR display, "exact amount" copy
    guard, confirmation counter (os-pulse), underpaid/overpaid
    tolerance settings, expired-address warnings.

S6 — DEPOSIT HISTORY TABLE
    Columns: initiated (EAT) · account · rail chip · amount (native +
    display) · fee · reference (agent tx / crypto hash truncated /
    broker ref) · status (initiated → pending → confirmed / failed /
    expired) · confirmed-at · proof link (manual rails) · ledger entry
    ref. Filters: account, rail, status, date. Export CSV.

S7 — FAILED DEPOSIT RECOVERY
    Stuck/failed deposits list: reason (timeout · underpaid · wrong
    network · agent unreachable · broker reject), suggested action per
    reason (retry · contact agent · submit tx hash for manual match),
    one-click "open broker support deep-link" where the provider has
    one. Recovery actions audit-logged.
```

---

### PAGE T-11: Withdrawals (`/dashboard/withdrawals`)

```
PURPOSE:
Take money out through broker APIs where allowed, with bank-grade
safety: whitelists, OTP confirmation, cooling periods, fee previews.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-withdrawals.css
Root class:        .page-dash-withdrawals
Motion hooks:      os-pulse on processing, count-up on KPIs,
                  row-flash-filled on settled

SECTIONS (7):

S1 — WITHDRAWALS KPI ROW (5 cards)
    Withdrawn this month · Pending · Processing (at broker) ·
    Settled today · Failed 7d.

S2 — WITHDRAWAL RAIL MATRIX
    Per account, rails + status: Deriv → withdraw API / paymentagent
    (M-Pesa) where eligible / cashier deep-link; Binance → crypto
    withdraw apply (whitelisted addresses); Alpaca → ACH (US);
    Exness/OANDA/cTrader → manual-rail (proof + ledger). Fee + ETA per
    rail. Unavailable rails render the manual flow (never hidden).

S3 — WITHDRAWAL BUILDER (drawer)
    Steps: account → rail → amount (vs available-withdrawable balance;
    blocks if margin would breach guard) → destination:
    • M-Pesa (via Deriv payment agent withdrawal): registered phone
      (OTP-verified) — agent fee shown
    • Crypto: whitelisted address picker + network + network-fee
      estimate (live) + "receive amount after fees"
    • Bank (where supported): masked account picker (whitelist)
    → SAFETY LADDER: 2FA TOTP → OTP to phone/email → cooling-period
    notice (configurable, default 0h for ≤$500, 24h above) → execute.

S4 — DERIV WITHDRAWAL API PANEL
    withdraw / paymentagent_withdraw flows: eligibility check (account
    verified, turnover rules), amount validation vs Deriv limits, submit
    → status polling via transaction stream → settled/rejected with
    broker message. Full request/response logged (minus secrets) to
    audit trail.

S5 — CRYPTO WITHDRAWALS PANEL
    Whitelist manager (add → 24h hold default → OTP confirm), network
    picker with fee comparison table (TRC20/ERC20/BEP20 live estimates),
    amount-after-fee calculator, address-book labels, "send small test
    amount first" nudge for new addresses (one-click test withdrawal).

S6 — WITHDRAWAL HISTORY TABLE
    initiated · account · rail · amount (native + display) · fee ·
    destination (masked) · status timeline (requested → otp-verified →
    submitted → processing → settled / rejected / reversed) · broker
    ref · settlement ref · receipt PDF. Filters + export.

S7 — WITHDRAWAL SAFETY CONTROLS
    Config panel: per-24h withdrawal cap · per-tx cap · cooling period
    slider · destination whitelist enforcement (strict/warn) ·
    "disable withdrawals while kill-switch PAUSED" toggle · every
    change here is audit-logged and requires 2FA.
```

---

### PAGE T-12: Transfers & Ledger (`/dashboard/transfers`)

```
PURPOSE:
Move funds between your own accounts (where APIs allow) and see the
whole money story: a double-entry ledger of every deposit, withdrawal,
transfer, trade P&L, commission and swap — reconciled against brokers.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-transfers.css
Root class:        .page-dash-transfers
Motion hooks:      count-up on ledger KPIs, row-flash-filled on posted
                  entries, os-spin on reconciliation jobs

SECTIONS (7):

S1 — LEDGER KPI ROW (5 cards)
    Net deposits (in − out, all time) · Internal balance vs broker
    aggregate (drift) · Transfers this month · Ledger entries today ·
    Reconciliation status chips per account.

S2 — TRANSFER BUILDER
    From account → To account · amount · rail:
    • Deriv: transfer_between_accounts (instant, API-native; currency
      conversion shown at broker rate)
    • Binance: universal transfer (spot↔funding↔futures, instant)
    • MT5↔MT5 (Exness→Exness): no MT API → two-leg simulated transfer
      (manual withdraw rail + manual deposit rail) with clear two-step
      checklist and combined ledger entry
    • Cross-broker (e.g. Deriv→Exness): always two-leg with explicit
      legs shown
    → preview (fees, FX rate, ETA per leg) → 2FA confirm → execute legs
      → combined receipt (leg-by-leg statuses).

S3 — TRANSFER HISTORY TABLE
    initiated · from → to (badges) · amount · rail · legs (per-leg
    status) · FX rate applied · fee · refs · status. Filters + export.

S4 — DOUBLE-ENTRY LEDGER (the money truth)
    Every posting: timestamp · entry type (deposit · withdraw ·
    transfer-in/out · trade-pnl · commission · swap · adjustment ·
    conversion-gain/loss) · debit account · credit account · amount
    (native + display) · source ref (trade/order/finance tx) ·
    balance-after per account. Filters by type/account/date; running
    balance column; imbalance alarm banner if debits ≠ credits
    (should be structurally impossible — alarms anyway).

S5 — FUNDING RAILS MANAGER
    Configure rails used by T-10/T-11: M-Pesa (agent preferences, phone
    book — OTP-verified entries), Airtel Money, bank EFT (Kenyan banks
    list), crypto wallets + networks + whitelists, card processors.
    Per-rail: fee schedule, min/max, default rail per account, enable/
    disable. Rail changes require 2FA (money-touching config).

S6 — STATEMENTS & AUDIT
    Monthly statement generator (PDF/XLSX per account): opening balance,
    deposits, withdrawals, transfers, trading net, commissions, swaps,
    closing balance, broker-verified where API history exists. Full
    audit trail of finance ops (who/when/what/otp-verified) with HMAC
    export.

S7 — RECONCILIATION DASHBOARD
    Internal ledger balance vs broker-reported balance per account:
    drift amount + drift age + probable cause hint (pending withdrawal,
    unbooked swap, FX timing) · auto-reconcile jobs (nightly BullMQ —
    pulls balances + transaction streams) · drift resolution wizard
    (post adjustment entry with reason, requires note; adjustment
    entries are typed and never silent). Status chips: SYNCED / DRIFT /
    STALE.
```

---

### PAGE T-13: AI Co-Pilot (`/dashboard/copilot`)

```
PURPOSE:
The AI layer that interconnects everything: a tool-calling assistant
that turns natural language into schedules, rules and orders; one-click
automation templates; an anomaly monitor; and a human-approval gate so
the AI proposes but YOU authorize.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-copilot.css
Root class:        .page-dash-copilot
Motion hooks:      typing indicator (os-pulse), fadeSlideUp on chat
                  bubbles, os-draw on proposal cards, row-flash on
                  executed AI actions

SECTIONS (7):

S1 — CO-PILOT KPI ROW (4 cards)
    AI actions taken (all-time) · Proposals accepted / rejected ·
    Anomalies caught (7d) · Manual overrides of AI decisions.

S2 — CHAT CONSOLE (tool-calling LLM)
    Chat UI with visible TOOL CALLS (collapsible chips showing which
    platform tool the model invoked: quotes.get, order.preview,
    schedule.create, rule.create, positions.close, ledger.query…).
    Example prompts with one-tap chips:
      "Create 20 schedules that buy R_10 RISE with 5 USD every 15
       minutes during the London session, max 3 open at once"
      "Close every EURUSD position losing more than $50 on Exness"
      "Summarize my trading week and rank my signal sources"
      "Set a guard: pause all automation if daily loss exceeds 4%"
    Safety: every tool that touches money/trades requires either
    (a) prior standing approval for that action class, or (b) inline
    APPROVE (2FA optional) — config in S7. Model never sees raw broker
    credentials; it calls platform APIs only.

S3 — ONE-CLICK AUTOMATIONS GALLERY
    Pre-built templates rendered as installable cards:
      • "London Breakout Ladder" — N grid schedules around London open
      • "Telegram Signal Auto-Exec" — rule template + guards preset
      • "Deriv Digits Bot Preset" — schedules for Even/Odd on R_100
      • "Session Close Sweep" — schedule that closes everything at 23:55 EAT
      • "Breakeven Mover" — rule: after +1R, SL → entry
    Each card: description, what it will create (exact schedules/rules
    count), risk-note, INSTALL → preview modal listing every created
    object → confirm → created (refs listed, deep-links).

S4 — SYMBOL & INTENT MAPPER
    Paste anything ("gold on exness", "us30 dow", a broker-symbol soup
    from a screenshot) → AI maps to canonical + per-account broker
    symbols with confidence; low-confidence asks once; accepted mappings
    persist to symbol_map (feeds §3.4). Batch mode: paste a provider's
    symbol glossary → mapping table proposal → accept all.

S5 — DAILY BRIEFING CARD (auto-generated, on load)
    AI-written morning note: overnight P&L per account, open risk,
    events today affecting held symbols, schedules/rules firing today,
    anomalies detected, 3 suggested actions (each with a direct tool
    button). Regenerate + "briefing settings" (time, tone, channels).

S6 — ANOMALY MONITOR
    Rules-first anomaly engine with ML roadmap: drawdown spike vs
    rolling baseline · fat-finger (stake > k× median) · signal storm
    (rate burst) · stale ticks / adapter freeze · margin spiral ·
    duplicate-schedule conflict (two schedules same symbol same minute).
    Each anomaly: card with evidence (charts/logs), severity, suggested
    action (pause rule / kill automation / flatten symbol), and
    auto-action if the trader enabled auto-mitigate (S7).

S7 — AI ACTIVITY LOG & APPROVAL POLICY
    Every AI action: timestamp · tool · arguments (redacted) · outcome ·
    approval path (standing / inline / auto) · linked refs. APPROVAL
    POLICY editor (per action class): order.place · position.close ·
    schedule.create · rule.create · finance.* — modes: ALWAYS ASK /
    STANDING (after first 2FA) / NEVER (block). Defaults conservative;
    finance.* is ALWAYS ASK, no exceptions. Full audit export.
```

---

### PAGE T-14: Risk & Guardrails (`/dashboard/risk`)

```
PURPOSE:
The layer that lets you walk away. Hard pre-trade checks, per-rule and
global circuit breakers, storm/fat-finger guards, and a kill switch
that flattens or pauses everything in one move.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-risk.css
Root class:        .page-dash-risk
Motion hooks:      os-pulse on armed kill-switch, count-up on KPIs,
                  row-flash-failed on blocked orders, glow-up/down on
                  state chips

SECTIONS (7):

S1 — RISK KPI ROW (5 cards)
    Daily P&L vs limit (progress ring, tick-flash) · Open risk ($ at
    stake if all SLs hit) · Margin level min today · Guardrail blocks
    today · Kill-switch state (ARMED / PAUSED / FLATTENED).

S2 — GUARDRAIL RULES TABLE
    Editable rules (each toggle + value + scope account/global):
    max daily loss % (circuit-breaker: pause all automation) ·
    max open positions · max stake per trade ($ or % equity) ·
    max leverage per account · per-symbol exposure cap · per-asset-class
    exposure cap · max trades/hour (global) · session limiter (stop
    trading after N hours/day — Deriv reality_check aligned) ·
    weekend/overnight hold policy. Changes require 2FA.

S3 — KILL SWITCH PANEL
    Three big buttons with confirm modals:
    • PAUSE AUTOMATION — schedules + rules stop evaluating (manual
      ticket still allowed)
    • CLOSE-ALL — flatten every position across every account
      (per-account receipts; retries; report on completion)
    • FULL LOCKDOWN — pause + revoke session tokens + require 2FA to
      re-arm
    Plus per-account kill (pause automation on one account) and
    per-rule kill. Kill-switch state is broadcast to Telegram + push
    instantly (§16). Last engagement + reason always displayed.

S4 — PRE-TRADE CHECK ENGINE
    The pipeline every order passes (manual, signal, schedule, AI):
    instrument tradable now → account allows (capability) → size ≥ min
    / ≤ max → margin available post-trade → guardrails → dedupe/storm →
    fat-finger → session window. Rendered as a live checklist per
    ticket (T-3 S4 embeds it); each block reason is user-readable
    ("BLOCKED: max stake/trade $200 (requested $350) — override?").
    Overrides: allowed only where the rule permits (never on
    circuit-breaker), require reason, audit-logged.

S5 — FAT-FINGER & STORM GUARDS
    Config + log: stake vs 30-day median multiplier (default 3×) ·
    duplicate order detector (same params within N s) · rapid-fire
    limiter (max submissions/min) · signal storm quarantine (→ T-4
    S7 log) · price-sanity check (entry > X% from quote → confirm).
    Log table: trigger · order/signal · action (blocked / quarantined /
    confirmed-anyway) · override reason.

S6 — SESSION LIMITS & REALITY CHECK
    Daily session clock (trading minutes today), reminder interval
    (Deriv reality_check mapping — the platform enforces its own even
    on MT5), forced-break suggestions, auto-stop after N consecutive
    losses (per account, configurable), and a "stop trading for today"
    soft-lock button (re-arms next EAT day).

S7 — RISK AUDIT LOG
    Every guardrail evaluation with outcome: timestamp · rule · subject
    (order/signal/schedule/AI) · decision (PASS / BLOCK / OVERRIDE) ·
    override reason · linked refs. Immutable (append-only); export CSV/
    JSON; feed for the AI anomaly engine.
```

---

### PAGE T-15: Notifications & Alerts (`/dashboard/notifications`)

```
PURPOSE:
Every event, your channels, your rules. Fill/SL/TP alerts, margin
calls, schedule fires, broker disconnects — delivered in-app, by email,
SMS, push, and Telegram, with quiet hours and digests.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-notifications.css
Root class:        .page-dash-notifications
Motion hooks:      fadeSlideUp on new items (Socket.IO), os-pulse on
                  unread dots, count-up on KPIs

SECTIONS (7):

S1 — KPI ROW (4 cards)
    Unread · Today · This week · Muted categories.

S2 — EVENT × CHANNEL MATRIX
    Grid: rows = event classes (order.filled · order.rejected ·
    sl.hit · tp.hit · margin.warning · margin.call · schedule.fired ·
    schedule.failed · rule.fired · guard.blocked · broker.disconnected ·
    adapter.reconnected · deposit.confirmed · withdraw.settled ·
    transfer.completed · copilot.proposal · killswitch.engaged ·
    anomaly.detected), columns = channels (In-app / Email / SMS /
    Push / Telegram). Per-cell toggle; SMS column shows cost-note;
    defaults sensible (fills: in-app+push; killswitch: ALL channels).

S3 — NOTIFICATION STREAM
    Unified list: icon per class · title · body · deep-link · channel
    delivery badges (✓ sent per channel) · timestamp · read state ·
    actions (mark read · mute class · delete). Filters by class,
    channel, read state, date. Bulk: mark-all-read, clear read.

S4 — ALERT RULES (price & risk triggers)
    Builder: price alert (symbol, above/below, one-shot/recurring) ·
    % move alert (since open / 24h) · margin-level alert (threshold) ·
    P&L alert (account daily P&L crosses X) · news/event alert (T-2
    calendar link). Each rule: channels, active toggle, fired-count,
    snooze. Triggered alerts land in the stream + chosen channels.

S5 — TELEGRAM CONTROL PANEL
    Bot status, linked chats (pairing code flow), command reference
    (/status /positions /pending /kill /closeall /pause /resume /
    alert <symbol> <price>), per-chat notification scope (all vs
    critical-only), inline-button deep actions (each Telegram button
    performs the same audited action as the dashboard).

S6 — DIGEST SETTINGS
    Daily digest (time in EAT, contents toggles: P&L, positions,
    automation summary, events tomorrow), weekly report (attach PDF
    from T-8 export center), monthly statement link. Digest preview
    button (renders next digest now).

S7 — QUIET HOURS & DELIVERABILITY
    Quiet hours (EAT range; critical classes always break through),
    per-channel rate limits (SMS/day cap — Africa's Talking budget
    guard), fallback chain (push → SMS if unread ≥ 10 min for
    critical), test-send buttons per channel with delivery proof.
```

---

### PAGE T-16: Settings (`/dashboard/settings`)

```
PURPOSE:
Platform configuration: security, appearance, locale, broker defaults,
inbound/outbound webhooks, data & privacy, feature flags. The trader
is the master admin — this page owns the whole instance.

STYLE RULES:
Page stylesheet:   src/styles/pages/dash-settings.css
Root class:        .page-dash-settings
Motion hooks:      fadeSlideUp per accordion section, os-spin on test
                  buttons

SECTIONS (7):

S1 — PROFILE & SECURITY
    Name, email, phone (change → OTP), password (current-password
    gate), 2FA (status, re-enroll, recovery codes regenerate),
    active sessions (device · IP · location · last seen · revoke all),
    login alerts toggle.

S2 — API KEYS & WEBHOOKS
    INBOUND: per-source webhook URLs (TradingView / generic /
    CopyFactory) with secret display (reveal-gated), rotation, last-hit
    stats; Telegram pairing reset. OUTBOUND: endpoint URL + HMAC
    secret + event picker (§3.5 list) + test-fire button + delivery
    log (status, latency, retries). API tokens for OStrade's own REST
    (for power users scripting against their own instance): create/
    rotate/revoke with scopes.

S3 — APPEARANCE & THEME
    Theme (dark default / light / system) · accent density (comfortable
    / compact) · chart theme (dark candles default) · number format ·
    mono-price toggle · reduce-motion override (respect OS default).

S4 — UNITS & LOCALE
    Display currency (USD native; KES display conversion toggle with
    daily rate source note) · timezone (Africa/Nairobi default; all
    schedules, sessions, digests honor it) · lots vs units preference ·
    P&L in $ or % default · week start, date format.

S5 — BROKER DEFAULTS (per adapter/account)
    Default account per context (manual / signals / schedules) ·
    symbol suffix override map (feeds §3.4) · slippage tolerance
    (market orders) · default TIF · Deriv app_id + branding fields ·
    MetaApi region default · max backfill days for history sync ·
    per-broker enable/disable switches (disabling hides its accounts
    everywhere but keeps credentials).

S6 — DATA & PRIVACY
    Export everything (ZIP: profile, orders, signals, ledger, audit —
    async job) · retention policy (ledger + audit: 7 years default;
    ticks: 90 days; adjust with storage warnings) · delete account
    (30-day soft delete; broker credentials destroyed immediately;
    exported data note; 2FA + typed confirmation) · DPA 2019 notice
    (Kenya) + consent log viewer (every consent event with hash).

S7 — FEATURE FLAGS & INTEGRATIONS
    Flags (toggle, env-scoped): enable_signal_automation ·
    enable_scheduler_bulk_paste · enable_copilot_tool_calls ·
    enable_telegram_control · enable_crypto_deposits ·
    enable_kes_display · enable_copyfactory_import ·
    enable_auto_mitigate (AI auto-action — default OFF) ·
    MAX_SCHEDULES (default 50) · MAX_SIGNAL_RULES (default 30) ·
    MAX_CONNECTED_ACCOUNTS (default 12).
    Integrations status cards: Telegram bot · TradingView webhooks ·
    CopyFactory · Google Sheets export · Africa's Talking (SMS) ·
    Resend (email) — each: connected state, test button, credential
    editor (vault-backed, write-only UI).
```

---

## 7. SHARED COMPONENTS

```
Located at src/styles/components/*.css — loaded once at app root,
rendered identically on every page.

COMPONENT INVENTORY:
├── StatCard             — KPI card (label, value, delta, icon; tick-flash)
├── BrokerBadge          — colored badge per broker (--broker-* palette)
├── AccountPill          — account chip (broker + label + LIVE/DEMO)
├── QuoteCell            — bid/ask cell with tick-flash + mono font
├── PriceFlash           — any numeric cell that flashes on change
├── SideTag              — BUY/SELL (▲/▼) chip, up/down colors
├── SourceBadge          — signal source chip (--src-* palette)
├── TriggerBadge         — schedule trigger chip (--trg-* palette)
├── StatusChip           — filled/rejected/timeout/pending/quarantined
├── SignalCard           — parsed signal preview (instrument, side,
│                          entry, SL/TP, confidence, warnings)
├── RuleCard             — automation rule summary (IF/THEN chips)
├── ScheduleCard         — schedule row/mini-card (trigger summary,
│                          next fire countdown)
├── PositionRow          — consolidated position line (tick-flash P&L)
├── LedgerEntry          — double-entry posting line (debit→credit)
├── KillSwitchButton     — top-bar global kill button (confirm modal)
├── SessionClock         — market session clock chip (EAT)
├── ChartWrapper         — Lightweight Charts wrapper (price-lines,
│                          resize observer, theme-aware)
├── MiniChart            — Recharts sparkline/mini bars
├── DataTable            — TanStack Table + Bootstrap styling +
│                          responsive collapse + sticky header
├── Stepper              — wizard steps (builder wizards)
├── Drawer               — slide-in right (lg+) / full-screen modal (sm)
├── FilterBar            — reusable filter chips + search
├── OTPInput             — 6-digit split input (auto-advance)
├── AmountInput          — size/amount input (lots/units/stake modes)
├── MappingRow           — symbol_map editor row (confidence chip)
├── ReceiptsPanel        — per-account execution receipts grid
├── ApprovalGate         — AI/finance inline approve (2FA optional)
├── EmptyState           — illustration + headline + CTA
└── Reveal               — scroll-reveal wrapper (.os-reveal)
```

---

## 8. STATE MANAGEMENT

```
SERVER STATE (TanStack Query) — query-key conventions:
  ["accounts", {filters}]                 — connected trading accounts
  ["account", id]                         — single account + capabilities
  ["adapters"]                            — adapter health snapshots
  ["symbols", {broker, search}]           — unified symbol universe
  ["symbol-map", accountId]               — resolved mappings
  ["quotes", symbols]                     — initial snapshot (then WS)
  ["candles", symbol, tf, range]          — chart data
  ["positions", {filters}]                — consolidated open positions
  ["orders-pending", {filters}]           — pending orders
  ["trades", {filters, page}]             — closed history (paginated)
  ["signals", {filters, page}]            — signal inbox/history
  ["signal-rules"], ["rule", id]          — automation rules
  ["schedules", {filters}], ["schedule", id]
  ["finance-tx", {type, filters}]         — deposits/withdrawals/transfers
  ["ledger", {filters, page}]             — ledger postings
  ["guards"], ["risk-audit", {filters}]
  ["copilot-threads"], ["copilot-thread", id]
  ["notifications", {filters}]
  ["settings", section]
  ["me"]                                  — current trader + defaults

INVALIDATION STRATEGY:
  order/position mutation → invalidate ["positions"], ["account", id],
    ["trades"] (on close)
  finance tx → invalidate ["finance-tx"], ["ledger"], ["account", id]
  rule/schedule mutation → invalidate respective keys + ["adapters"]
  settings change → targeted invalidation only

LIVE STATE (Socket.IO + broker WS multiplexer):
  tick:<symbol>            — batched quote deltas (client coalesces
                             flashes to 300ms windows)
  position:update          — position state changes (flash rows)
  order:update             — order lifecycle (submitted/filled/failed)
  signal:new               — inbox push (fadeSlideUp)
  rule:decision            — automation decisions live
  schedule:fired           — scheduler events
  finance:update           — deposit/withdraw/transfer status
  alert:new                — notifications + toasts
  adapter:health           — status ribbon updates
  Kill-switch state is pushed to ALL open tabs + Telegram instantly.

CLIENT STATE (Zustand, minimal):
  uiStore        — sidebar, theme, density, drawer stack, active modal
  contextStore   — ACTIVE CONTEXT (default account, fan-out selection,
                   LIVE/PAPER global mode) — persisted per user,
                   consumed by T-2/T-3/T-4
  ticketStore    — in-progress ticket draft (accounts, instrument,
                   params) — survives route changes, not reloads
  chatStore      — copilot conversation buffers

IDEMPOTENCY & ORDER SAFETY:
  Every mutating call → UUID idempotency key → Redis SETNX (10min TTL)
  → duplicate submissions return the original result (no double orders).
```

---

## 9. DATABASE SCHEMA

```
PostgreSQL 16 + Prisma ORM. Core tables (simplified):

users
  id (uuid, pk) · email (unique) · phone · password_hash ·
  role (enum: TRADER)   — single-operator: first user = master admin ·
  status · two_factor_enabled · totp_secret · recovery_codes (jsonb) ·
  timezone (default 'Africa/Nairobi') · display_currency ·
  created_at · last_login_at

risk_profiles
  user_id · experience_level · instruments (text[]) ·
  automation_intent · max_daily_loss_pct_suggested ·
  max_positions_suggested · max_stake_suggested · completed_at

broker_connections
  id (uuid, pk) · user_id · adapter (enum: DERIV · EXNESS_MT5 ·
    MT5_GENERIC · CTRADER · ALPACA · BINANCE · OANDA) ·
  label · credentials_vault_ref (opaque ref — secrets NEVER in DB) ·
  oauth_tokens_ref · region · status (CONNECTED · DEGRADED · DOWN ·
  REVOKED) · capabilities_cache (jsonb) · last_health_at ·
  created_at

trading_accounts
  id (uuid, pk) · connection_id (fk) · broker_account_id (broker-side
    login/uuid) · account_type (LIVE · DEMO) · currency ·
  leverage · balance_cache · equity_cache · margin_used_cache ·
  margin_level_cache · is_default_for (jsonb: {manual, signals,
  schedules}) · status · synced_until · created_at

symbol_map
  id · canonical · adapter · broker_symbol · account_type_suffix ·
  pip_position · contract_size · min_volume · volume_step ·
  max_leverage · sessions (jsonb) · confidence · source (MANUAL ·
  AUTO · AI) · created_by · created_at
  UNIQUE (canonical, adapter, account_type_suffix)

quotes_cache (Redis-primary; PG for history):
  canonical · adapter · bid · ask · spread · last · day_change_pct ·
  updated_at · tick_seq

orders
  id (uuid, pk) · ref (OS-ORD-XXXXXX, unique) · user_id ·
  account_id (fk) · canonical_symbol · broker_symbol ·
  side (BUY/SELL) · order_kind (MARKET · LIMIT · STOP · STOP_LIMIT ·
  CONTRACT) · contract_params (jsonb, Deriv) · size · requested_price ·
  sl · tp · tif · status (PENDING_SUBMIT · SUBMITTED · FILLED ·
  PARTIAL · REJECTED · CANCELED · EXPIRED · FAILED) ·
  broker_order_ref · fill_price · fill_size · commission · swap ·
  source_type (MANUAL · SIGNAL · SCHEDULE · AI) · source_ref ·
  idempotency_key (unique) · submitted_at · filled_at ·
  broker_message · latency_ms · created_at

positions
  id (uuid, pk) · account_id · broker_position_ref · canonical_symbol ·
  broker_symbol · side · size · entry_price · current_price_cache ·
  sl · tp · swap_cache · pnl_cache · opened_at · closed_at ·
  close_price · realized_pnl · source_type · source_ref · status

schedules
  id · ref (OS-SCH-XXXX) · user_id · name · trigger_type (ONE_TIME ·
    CRON · INTERVAL · SESSION · PRICE · INDICATOR) ·
  trigger_config (jsonb — cron expr / interval / session window /
    price condition / indicator params, EAT-normalized) ·
  account_ids (uuid[]) · size_mode (FIXED · PCT_EQUITY) ·
  size_value · order_params (jsonb — reuse T-3 builder shape) ·
  status (ARMED · PAUSED · COMPLETED · FAILED · EXPIRED) ·
  expiry_policy (jsonb) · max_consecutive_failures ·
  failure_count · next_fire_at · last_fired_at · created_at

schedule_fires
  id · schedule_id · fired_at · condition_snapshot (jsonb) ·
  order_ref · outcome (FILLED · REJECTED · TIMEOUT · SKIPPED) ·
  retry_count · broker_message

signal_sources
  id · user_id · kind (PASTE · TELEGRAM · WEBHOOK · EMAIL · CSV ·
    COPYFACTORY) · label · secret_ref · config (jsonb) ·
  status (ACTIVE · MUTED) · signals_today · last_received_at

signals
  id · ref (OS-SIG-XXXXXX) · source_id · raw_text ·
  parsed (jsonb: instrument · side · entry_type · entry · sl · tp ·
    size_hint · legs[] · duration) · parse_confidence ·
  status (RECEIVED · PARSED · STAGED · EXECUTED · FILLED · REJECTED ·
    QUARANTINED · EXPIRED · FAILED) · quarantine_reason ·
  attributed_pnl · received_at · executed_at

signal_rules
  id · ref (OS-RULE-XX) · user_id · name · source_id ·
  conditions (jsonb) · actions (jsonb — accounts, size mode, SL/TP
    handling, execution style) · guards (jsonb — max/hour, dedupe,
    circuit-breaker link) · status (DRAFT · ACTIVE · PAUSED) ·
  fired_today · last_decision · created_at

rule_fires
  id · rule_id · signal_id · decision (EXECUTED · SKIPPED · BLOCKED) ·
  reason · order_refs (uuid[]) · latency_ms · evaluated_at

risk_guards
  id · user_id · code (MAX_DAILY_LOSS · MAX_POSITIONS · MAX_STAKE ·
    MAX_LEVERAGE · SYMBOL_EXPOSURE · CLASS_EXPOSURE · MAX_TRADES_HOUR ·
    SESSION_LIMIT · FAT_FINGER · STORM · PRICE_SANITY · DUP_ORDER) ·
  scope (GLOBAL · ACCOUNT · RULE) · scope_ref · threshold (jsonb) ·
  active · override_allowed · updated_at · updated_by

guard_violations
  id · guard_id · subject_type (ORDER · SIGNAL · SCHEDULE · AI) ·
  subject_ref · decision (BLOCK · QUARANTINE · OVERRIDE) ·
  override_reason · evidence (jsonb) · at

finance_transactions
  id · ref (OS-FIN-XXXXXX) · user_id · type (DEPOSIT · WITHDRAW ·
    TRANSFER) · account_id · rail (PAYMENT_AGENT · CASHIER · CRYPTO ·
    BANK · CARD · MPESA · AIRTEL · MANUAL · INTERNAL · UNIVERSAL) ·
  amount_native · currency_native · amount_display · fee ·
  status (INITIATED · PENDING · CONFIRMED · SETTLED · FAILED ·
    REVERSED · EXPIRED) · destination_ref (masked) · proof_doc_id ·
  broker_ref · network (crypto) · confirmations · idempotency_key ·
  initiated_at · settled_at · metadata (jsonb)

ledger_entries
  id · tx_type (DEPOSIT · WITHDRAW · TRANSFER_IN · TRANSFER_OUT ·
    TRADE_PNL · COMMISSION · SWAP · ADJUSTMENT · FX_GAIN · FX_LOSS) ·
  debit_account_id · credit_account_id · amount_native ·
  amount_display · source_ref (order/finance tx) · memo ·
  balance_after_debit · balance_after_credit · posted_at
  -- INVARIANT CHECK (nightly + on write): SUM(debits) = SUM(credits)
     per account; imbalance → alarm row + UI banner

reconciliations
  id · account_id · ran_at · broker_balance · ledger_balance ·
  drift · drift_cause_hint · status (SYNCED · DRIFT · STALE) ·
  resolved_at · resolution_note

ai_actions
  id · user_id · thread_id · tool · args_redacted (jsonb) ·
  outcome · approval_mode (ALWAYS_ASK · STANDING · AUTO) ·
  approved_by_user (bool) · order_ref / schedule_ref / rule_ref /
  finance_ref · created_at

ai_conversations / ai_messages
  thread metadata + messages (role, content, tool_calls, tool_results)

notifications
  id · user_id · class (enum §16) · title · body · deep_link ·
  channels_sent (jsonb) · read_at · created_at

alert_rules
  id · user_id · kind (PRICE · PCT_MOVE · MARGIN · PNL · EVENT) ·
  config (jsonb) · channels (text[]) · status · fired_count ·
  last_fired_at

webhooks_in / webhooks_out
  inbound: id · kind · secret_hash · last_hit_at · hits_24h
  outbound: id · url · hmac_secret_ref · events (text[]) ·
  active · delivery_log_ref

watchlist_items / journal_notes / audit_trail
  watchlist: user_id · canonical · sort_order · note
  journal: subject_type (TRADE · DAY) · subject_ref · body ·
    tags (text[]) · screenshots (uuid[])
  audit_trail: id · actor · action · entity_type · entity_id ·
    before (jsonb) · after (jsonb) · ip · user_agent · created_at
    -- IMMUTABLE (append-only trigger)
```

---

## 10. SIGNAL ENGINE

```
INGESTION CHANNELS:
  1. PASTE      — Signal Desk console (always available)
  2. TELEGRAM   — @OStradeBot: forward/relay messages → parse
  3. WEBHOOK    — POST /webhooks/tradingview/{secret} and /generic/{secret}
  4. EMAIL      — forward-to inbox → body + attachments parsed
  5. CSV        — bulk import (provider exports)
  6. COPYFACTORY— MetaApi provider strategy stream → signals

PARSER GRAMMAR (v1, deterministic-first with AI fallback):
  INSTRUMENT   canonical or broker symbol or alias ("gold"→XAUUSD,
               "dow"→US30, "cable"→GBPUSD, "bitcoin"→BTCUSDT)
  DIRECTION    BUY|LONG|RISE|CALL  ·  SELL|SHORT|FALL|PUT
  ENTRY        market (default) · "@ 2385.50" · "LIMIT 1.0850" ·
               "STOP 64,500" · "above/below X" (price-trigger)
  SL/TP        price ("SL 2378.00") · pips ("SL 40p") · % ("SL 0.5%") ·
               money ("SL $50" → guardrail-defaults note) ·
               TP1/TP2/TP3 → scale-out legs
  SIZE         "lot 0.2" · "0.2 lots" · "stake 5usd" · "size 100" ·
               absent → rule/account default
  DURATION     "ticks 5" · "5 min" · "1 hr" (Deriv contracts)
  NOISE        emoji, channel headers, images (dropped), disclaimers
  CONFIDENCE   deterministic full-match = 100; partial (missing SL,
               ambiguous alias) = scaled; AI fallback adds reasoning +
               flagged fields

SIGNAL LIFECYCLE:
  RECEIVED → PARSED (+confidence, warnings)
           → QUARANTINED (dedupe/storm/malformed — one-click override)
           → STAGED (in desk, awaiting Place)
           → EXECUTED (fan-out to N accounts → N orders)
           → FILLED / REJECTED / FAILED (per-account receipts)
           → attributed P&L joins source leaderboard on close

DEDUPE & STORM GUARDS:
  • duplicate: same (source, instrument, side, entry) within
    DUP_WINDOW_MIN (default 10)
  • storm: > STORM_RATE signals/min from one source (default 8)
  • stale: entry > STALE_PCT away from current quote (default 3%)
  All three visible + overridable-with-reason (T-4 S7, §15).

FAN-OUT EXECUTION:
  For each selected account: resolve symbol (symbol_map) → convert
  size/SL/TP per account (pip size, contract size, currency) →
  capability check → pre-trade guards (§15) → adapter order →
  per-account receipt. Partial failure NEVER aborts other legs;
  failed legs are retryable individually.
```

---

## 11. SCHEDULER ENGINE

```
SCHEDULE TYPES (trigger_config shapes, all EAT-normalized):
  ONE_TIME   { fireAt }                        → BullMQ delayed job
  CRON       { expr, tz: 'Africa/Nairobi' }    → repeatable job
  INTERVAL   { everyMin, windowStart, windowEnd }  → repeat + window guard
  SESSION    { session: LONDON|NY|OVERLAP|ASIA|SYDNEY|CUSTOM,
               action: AT_OPEN|AT_CLOSE|EVERY_N_WITHIN, n? }
  PRICE      { symbol, condition: CROSSES_ABOVE|CROSSES_BELOW|
               PCT_MOVE_SINCE_OPEN|SPREAD_BELOW, value }
               → tick-watcher subscription; evaluated server-side
  INDICATOR  { symbol, tf, kind: RSI_BELOW|RSI_ABOVE|EMA_CROSS|
               ATR_SPIKE, params }  → candle-cache evaluator

SESSION WINDOWS (default, EAT = UTC+3, editable):
  Sydney  00:00–09:00 · Tokyo 03:00–12:00 · London 10:00–19:00 ·
  New York 16:00–01:00 · London-NY overlap 16:00–20:00
  (Synthetics/crypto schedules ignore sessions — 24/7 markets.)

CAPS & SAFETY:
  MAX_SCHEDULES (default 50; 20-at-a-go floor guaranteed by bulk paste) ·
  MAX_SIGNAL_RULES (30) · per-schedule max_consecutive_failures
  (auto-PAUSE after N, default 3) · expiry policy (never / at-date /
  after N skips) · all schedules respect kill-switch (PAUSED kills
  evaluation; FLATTENED closes and disarms).

BULK PASTE GRAMMAR (superset of signal grammar):
  "<instrument> <action+size+SL/TP> <schedule clause>"
  schedule clauses: "at 2025-03-04 10:00" · "every 15min london" ·
  "cron 0 */2 * * *" · "at NY-open" · "if crosses_below 2380" ·
  "if rsi14_15m < 30"
  → 20-line paste → 20 previewed schedules → 1 batch create.

EVALUATION LOOP (price/indicator triggers):
  TickWatcher subscribes per trigger symbol (shared with quote cache);
  conditions evaluated on a 1s tick loop with hysteresis; trigger →
  pre-trade guards → adapter order → schedule_fires row → notification.
  Latency budget: condition → submit < 750ms p95.
```

---

## 12. BROKER ADAPTER ENGINE

```
ADAPTER LIFECYCLE:
  connect → provision (MetaApi deploy / Deriv authorize / key auth)
          → capabilities fetch + cache
          → first sync (symbols, symbol_map build, positions, history
            backfill default 90 days)
          → streams on (ticks, account info, positions)
          → health monitor loop (30s)

HEALTH MONITOR:
  ws state · latency p50/p95 (heartbeat round-trip) · last-tick age ·
  reconnect count 24h · rate-limit headroom (per-broker budgets:
  Deriv ~ calls/s by app tier; MetaApi per-account; Binance weight
  budget; Alpaca 200 msg/min) · clock skew ms
  states: LIVE (ok) → DEGRADED (latency/tick age breach) → DOWN
  (3 failed reconnects) → page T-9 diagnostics + alert (§16).

RECONNECT POLICY:
  exponential backoff 1s → 2s → 5s → 15s (cap 60s); on reconnect:
  re-subscribe streams, reconcile open positions vs broker snapshot
  (missing local position → adopt from broker + audit row), replay
  missed ticks gap via REST history.

ORDER STATE RECONCILIATION:
  broker is truth for FILLED/CANCELED; internal states adopt broker
  via streams + a 60s sweeper for silent gaps; every adoption writes
  an audit row (never silent).

RATE LIMIT & FAIR USE:
  per-adapter token buckets in Redis; order fan-out across N accounts
  is burst-shaped (BullMQ concurrency per adapter); 429 responses →
  automatic backoff + retry within idempotency window.

CLOCK & SESSIONS:
  broker server time vs EAT skew tracked per adapter; session/one_time
  schedules fire on EAT wall clock adjusted for skew.
```

---

## 13. FINANCE ENGINE

```
RAILS MATRIX (capabilities-driven, per §3.3):
  DEPOSIT:   Deriv → paymentagent_transfer (M-Pesa agents, Kenya) ·
             cashier deep-link · crypto where offered
             Binance → crypto address (auto-gen) · internal transfer
             Alpaca → ACH (US banks)
             Exness/MT5 · cTrader · OANDA → MANUAL rail (proof + ledger)
  WITHDRAW:  Deriv → withdraw / paymentagent_withdraw (M-Pesa) ·
             cashier deep-link
             Binance → capital/withdraw/apply (whitelisted addresses)
             Alpaca → ACH
             others → MANUAL rail
  TRANSFER:  Deriv transfer_between_accounts (API, instant) ·
             Binance universal transfer (API, instant) ·
             MT5↔MT5 / cross-broker → TWO-LEG simulated transfer
             (withdraw leg + deposit leg, explicit checklist)

LIFECYCLE (all rails):
  INITIATED → PENDING → CONFIRMED (credited) → SETTLED (broker-side
  final) | FAILED | REVERSED | EXPIRED
  Manual rails: CONFIRMED requires balance-delta verification or
  explicit admin-of-self confirmation with proof (never auto-guess).

DEPOSIT AUTO-MATCH:
  For API rails the transaction stream / webhook confirms credit.
  For crypto: address → expected amount + tolerance → confirmation
  counter → auto-credit at N confirmations.
  For deep-link (Deriv cashier): watch balance + transaction events
  for a matching credit within a 60-min window → match → confirm;
  unmatched after window → recovery queue (T-10 S7).

SAFETY LADDER (withdrawals):
  available-withdrawable check (margin-aware) → whitelist check →
  2FA → OTP → cooling period (0h ≤ $500 default, 24h above; editable)
  → execute → status timeline → receipt.
  Withdrawals BLOCKED while kill-switch = PAUSED (toggle) — default ON.

DOUBLE-ENTRY LEDGER:
  Every money movement + every realized P&L/commission/swap posting
  hits ledger_entries (debit/credit accounts, source refs, balance
  afters). Nightly invariant: Σ debits = Σ credits per account;
  violation → alarm row + banner (structurally impossible; alarm
  anyway).

RECONCILIATION:
  Nightly BullMQ: pull balances + transaction histories per account →
  compare vs ledger → drift report (amount, age, cause hint) →
  T-12 S7 wizard for resolution (typed ADJUSTMENT entries only, with
  mandatory reason + audit).
```

---

## 14. AI CO-PILOT ENGINE

```
MODEL ACCESS:
  LLM with tool-calling; tools are OStrade platform APIs ONLY —
  the model never sees broker credentials, never holds raw API keys.
  Tool list (subset): quotes.get · symbol.map · order.preview ·
  order.place (gated) · position.close (gated) · position.modify (gated)
  schedule.create (gated) · schedule.list · rule.create (gated) ·
  signal.list · ledger.query · account.summary · guard.set (gated) ·
  export.run

APPROVAL POLICY (per action class, trader-editable, T-13 S7):
  order.place · position.close/modify · schedule.create · rule.create:
    ALWAYS ASK (default) | STANDING (after first 2FA approval) | NEVER
  finance.* (deposit/withdraw/transfer): ALWAYS ASK — cannot be relaxed.
  Every approval / rejection is an ai_actions row + audit entry.

ONE-CLICK AUTOMATIONS:
  Templates expand into exact object sets (schedules + rules + guards)
  with a preview modal before install; installed objects carry
  source=AI + template id for attribution.

ANOMALY MONITOR (rules-first, ML roadmap):
  drawdown spike vs rolling baseline · fat-finger stake · signal storm ·
  stale ticks / adapter freeze · margin spiral (level < 50% falling) ·
  duplicate-schedule conflict (same symbol+minute) · guard override
  burst (≥ 5 overrides/hour).
  Response ladder: notify → suggest action → auto-mitigate ONLY if
  enable_auto_mitigate flag ON (default OFF) and the anomaly class is
  whitelisted for auto (e.g. pause a storming rule).

BRIEFING GENERATOR:
  Daily 07:00 EAT job: overnight P&L per account, open risk if all SLs
  hit, today's events on held symbols, schedules/rules firing today,
  anomalies, 3 suggested actions (tool-buttons attached).

SYMBOL/INTENT MAPPER:
  Fuzzy + alias resolution for any pasted instrument text → canonical +
  per-account broker symbols with confidence; accepted mappings persist
  to symbol_map (source=AI). Below 0.9 confidence → single confirm,
  then remembered.
```

---

## 15. RISK & GUARDRAIL ENGINE

```
PRE-TRADE CHECK PIPELINE (every order — manual, signal, schedule, AI):
  1. symbol tradable now (session open / 24-7 market)
  2. account capability check (can this broker do this order kind?)
  3. size ≥ min && ≤ max (broker + guardrail)
  4. margin available post-trade (margin level floor respected)
  5. guardrails: max daily loss headroom · max open positions ·
     max stake/trade · max leverage · per-symbol / per-class exposure
  6. dedupe + storm + fat-finger + price-sanity
  7. session window (rule/schedule scoped)
  → PASS → execute · BLOCK (reason shown, override where permitted)
  → circuit-breaker rules (daily loss) CANNOT be overridden.

GUARDRAIL DEFAULTS (from risk profile, A-3; editable T-14):
  max daily loss 4% of aggregate equity (circuit-breaker → PAUSE
  automation) · max open positions 12 · max stake/trade $200 ·
  max leverage per account as configured · symbol exposure cap 20% of
  equity · max trades/hour 30 global.

KILL SWITCH (3 levels):
  PAUSE AUTOMATION — rules + schedules stop evaluating; manual trading
  still allowed (with guards).
  CLOSE-ALL — flatten every position across all accounts (per-account
  receipts, retries, completion report); schedules disarm.
  FULL LOCKDOWN — pause + revoke sessions + 2FA-required re-arm.
  Per-account and per-rule kills available. State broadcast to ALL
  channels instantly (Telegram, push, SMS — §16). Every engagement
  (manual or circuit-breaker) is audit-logged with reason + evidence.

SESSION & REALITY LIMITS:
  trading-minutes/day counter · Deriv reality_check mapped (interval,
  lockout) · platform-enforced reminder even on MT5 · N-consecutive-
  losses auto-stop (per account, configurable) · "stop for today"
  soft-lock re-arming at EAT midnight.
```

---

## 16. NOTIFICATIONS & COMMS

```
CHANNELS:
  In-app (always) · Email (Resend) · SMS (Africa's Talking — Kenya
  first) · Web Push · Telegram (@OStradeBot, with deep-action buttons)

EVENT MATRIX (defaults; per-cell editable — T-15 S2):
  order.filled        → in-app + push
  order.rejected      → in-app + push + email
  sl.hit / tp.hit     → in-app + push
  margin.warning 80%  → in-app + push
  margin.call  50%    → in-app + push + SMS
  schedule.fired      → in-app
  schedule.failed     → in-app + push + email
  rule.fired          → in-app
  guard.blocked       → in-app (critical → +push)
  broker.disconnected → in-app + push + email
  deposit.confirmed   → in-app + push + email
  withdraw.settled    → in-app + push + email + SMS
  transfer.completed  → in-app + email
  copilot.proposal    → in-app (+approval deep-link)
  killswitch.engaged  → ALL channels (non-negotiable)
  anomaly.detected    → in-app + push (severity-scaled)

TELEGRAM REMOTE CONTROL:
  /status · /positions · /pending · /alert <symbol> <price> ·
  /pause · /resume · /kill · /closeall (2FA-challenge on money-class
  commands: inline confirm → OTP for withdraw-class) — every Telegram
  action is the same audited action as the dashboard, attributed
  source=TELEGRAM.

DELIVERABILITY GUARDS:
  SMS/day cap + budget guard (Africa's Talking) · quiet hours EAT
  (critical classes break through) · fallback chain: push unread ≥
  10min on critical → SMS · dedupe of M-Pesa-native SMS vs OStrade
  SMS (suppress duplicates on the same deposit event).

DIGESTS:
  Daily 07:00 EAT briefing (AI-generated, T-13 S5) · weekly PDF report
  (T-8 export) · monthly statement link (T-12 S6).
```

---

## 17. COMPLETE PAGE INDEX

```
HOME (3):
H-1   /                        Landing
H-2   /brokers                 Brokers & capabilities
H-3   /how-it-works            Signal → trade flow

AUTH & ONBOARDING (8):
A-1   /auth/signup             Sign up
A-2   /auth/signin             Sign in
A-3   /auth/onboard            Onboarding wizard (profile · risk · prefs)
A-4   /auth/broker-connect     First broker connection hub
A-5   /auth/forgot-password    Forgot password
A-6   /auth/reset-password     Reset password
A-7   /auth/verify-otp         Verify OTP
A-8   /auth/2fa                TOTP enrollment

TRADER DASHBOARD (16) — 7+ sections each:
T-1   /dashboard                    Command center
T-2   /dashboard/markets            Markets (multi-broker explorer)
T-3   /dashboard/trade              Trade ticket (multi-account fan-out)
T-4   /dashboard/signals            Signal desk (paste → place)
T-5   /dashboard/automation         Signal automation engine (IF/THEN)
T-6   /dashboard/scheduler          Trade scheduler (20+ at a go)
T-7   /dashboard/positions          Positions & orders (consolidated)
T-8   /dashboard/records            Trade records & analytics
T-9   /dashboard/accounts           Accounts & broker hub (switcher)
T-10  /dashboard/deposits           Deposits (rails per capability)
T-11  /dashboard/withdrawals        Withdrawals (safety ladder)
T-12  /dashboard/transfers          Transfers & double-entry ledger
T-13  /dashboard/copilot            AI co-pilot (tools + templates)
T-14  /dashboard/risk               Risk & guardrails (kill switch)
T-15  /dashboard/notifications      Notifications & alerts
T-16  /dashboard/settings           Settings (master-admin config)

TOTAL PAGES: 3 + 8 + 16 = 27
TOTAL STYLESHEETS: 27 page-scoped + 1 app-shell = 28 (strict 1-to-1)
```

---

## 18. IMPLEMENTATION PHASES

```
PHASE 0 — FOUNDATION (Weeks 1-2)
  Repo scaffolding: TanStack Start + Vite + Bootstrap 5.3 + Prisma
  Design tokens (§2) → tokens.css; app-shell (sidebar, top bar with
  account-context switcher + kill-switch button) → app-shell.css
  Auth: A-1, A-2, A-5, A-6, A-7, A-8 (OTP + TOTP + sessions)
  DB migrations: users, risk_profiles, audit_trail
  Secrets vault + credential encryption (AES-256-GCM)

PHASE 1 — BROKER LAYER (Weeks 3-6)  ← the platform's spine
  BrokerAdapter interface + registry (§3.1)
  Deriv adapter (WS multiplexer, OAuth, proposal/buy/sell, streams)
  MetaApi adapter (Exness/MT5: provisioning, deploy, orders, streams)
  Alpaca adapter (paper + live) · Binance adapter (spot + testnet)
  OANDA adapter (practice) · cTrader adapter (stretch)
  symbol_map + resolution pipeline (incl. suffix logic + AI fallback)
  A-3 onboarding wizard + A-4 broker-connect (all flows + test-connection)
  Adapter health monitor + reconnect + reconciliation sweeper (§12)

PHASE 2 — MARKETS + TICKET (Weeks 7-9)
  T-2 Markets (watchlist, explorer, Lightweight Charts, symbol drawer)
  T-3 Trade Ticket (multi-select, MT builder, Deriv contract builder,
      risk preview, confirm → receipts, quick-repeat)
  Tick flash system (coalesced) + quote cache + rate-limit buckets
  T-1 Command Center v1 (KPIs, equity curve, positions snapshot,
      status ribbon, market clocks)

PHASE 3 — SIGNALS (Weeks 10-12)
  Signal ingestion channels: paste, TradingView/generic webhooks,
  Telegram bot (parse + /status), email inbound, CSV import
  Parser grammar v1 + AI fallback + confidence scoring
  T-4 Signal Desk (console, execution panel, history, copy-trade
      importers, source leaderboard, guard log)
  T-7 Positions & Orders (consolidated book, modify/partial/reverse,
      bulk actions, Deriv contracts panel, margin monitor)

PHASE 4 — AUTOMATION (Weeks 13-15)
  T-5 Signal Automation (rules engine, builder wizard, dry-run
      simulator, audit log)
  T-6 Scheduler (6 trigger types, BullMQ engine, calendar + timeline,
      bulk-paste 20-at-a-go builder, execution logs)
  TickWatcher for price/indicator triggers (§11)
  T-14 Risk (guard pipeline on EVERY path, kill switch 3 levels,
      storm/fat-finger guards, session limits)

PHASE 5 — RECORDS + FINANCE (Weeks 16-19)
  T-8 Records (unified history, analytics, attribution, statement
      reconciliation, export center incl. KRA-ready, journal)
  T-10 Deposits (rail matrix, Deriv paymentagent/cashier automation,
      crypto address flows, manual-rail proofs)
  T-11 Withdrawals (safety ladder, Deriv withdraw API, crypto whitelist)
  T-12 Transfers & Ledger (Deriv/Binance API transfers, two-leg MT5
      flows, double-entry ledger, nightly reconciliation)

PHASE 6 — AI + COMMS (Weeks 20-22)
  T-13 Co-pilot (tool-calling chat, approval gates, automation
      templates, symbol mapper, briefing, anomaly monitor)
  T-15 Notifications (event×channel matrix, alert rules, Telegram
      deep-actions, digests, quiet hours)
  Outbound webhooks (HMAC) + inbound secret rotation (T-16 S2)

PHASE 7 — SETTINGS + HOME + POLISH (Weeks 23-24)
  T-16 Settings (security, webhooks, locale, broker defaults, DPA
      data controls, feature flags)
  T-9 Accounts hub completion (wizard in-dashboard, diagnostics,
      active-context switcher, symbol mapping editor, audit)
  H-1 / H-2 / H-3 marketing pages (capability matrix public view)
  i18n-ready copy, WCAG 2.1 AA pass, reduced-motion pass,
  performance pass (route code-splitting, quote-stream virtualization)

PHASE 8 — PAPER PILOT → LIVE (Weeks 25-26 + ongoing)
  Pilot on PAPER only: Deriv demo + Exness MT5 Trial + Alpaca paper
  Run the full loop: connect → paste 10 signals → execute → schedule
  20 → let rules run a week → reconcile ledger vs brokers
  Guardrail soak test (force circuit-breaker, kill-switch drills)
  Then LIVE accounts one at a time (2FA enforced, cooling periods on,
  low caps first) · k6 load test (500 WS clients) · Sentry triage ·
  prod deploy (Cloudflare + ECS + RDS + ElastiCache + S3)
```

---

## END OF OUTLINE

```
This file (ostradeMO.md) is the single source of truth for OStrade's
page-level outline, design tokens, page-to-stylesheet mapping, broker
adapter contracts, capability matrix, engine specifications, data
model, and implementation phasing.

COMPANION FILES (same document grammar):
  learnlyMO.md              — academic sponsorship platform (sibling)
  ostradeMO_build_prompt.md — per-page build prompt (same grammar as
                              learnlyMO_build_prompt.md; set PAGE_ID
                              to T-x / A-x / H-x and ROUTE to the
                              matching path above)

GOLDEN RULES (restated):
  1. Broker APIs are the ceiling — the capability matrix is law.
  2. Paper first. LIVE behind 2FA, guards, and cooling periods.
  3. Every order, every rule fire, every shilling: attributed,
     reconciled, and audited.
  4. The trader may walk away — automation, Telegram control, and the
     kill switch make that safe.
```
