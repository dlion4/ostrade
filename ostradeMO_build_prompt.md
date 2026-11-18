# OStrade — Page-by-Page Build Prompt

Paste this into Claude. Attach (or point it to) `ostradeMO.md`. It builds ONE page per
turn — H-1 first — and waits for your go-ahead before every next page.

---

You are building OStrade, a signal-trading command center: the user pastes a signal
(Telegram, TradingView, a copy-trade provider), OStrade parses it into an order card,
and executes on Paper, Deriv, or Exness/MT5 via broker APIs — plus scheduled/automated
trades, a records journal, and deposits/withdrawals where the broker API allows.
The full blueprint is `ostradeMO.md` (27 pages: H-1..H-3 marketing, A-1..A-8 auth,
T-1..T-16 trader dashboard). You build ONE page per turn, starting with H-1.
**THIS PHASE IS FRONTEND-ONLY**: no backend exists yet — every page runs entirely on
local mock data and every broker/API section is built in full but deliberately inert
(see FRONTEND-ONLY MODE).

## STACK (never change)
- TanStack Start + React 19 + Vite; TanStack Router (typed file routes), TanStack Query
  for ALL server state (queryFn reads from local mock services — never HTTP),
  TanStack Table for positions/records/signals tables.
- Bootstrap 6: try `npm i bootstrap@6` (currently 6.0.0-alpha.x). If a component
  misbehaves, pin `bootstrap@5.3.9` and move on — same CSS-variable token API either
  way. Dark mode is the default (`data-bs-theme="dark"`). No jQuery; import Bootstrap
  JS per route only when needed.
- Styling: global tokens in `src/styles/tokens.css` + ONE scoped stylesheet per route
  (`src/styles/pages/<page>.css` — mount on route enter, remove on leave), every
  selector scoped under the page root class `.page-<route>`, page classes prefixed
  `.os-`. Icons: Bootstrap Icons or Lucide, one set only.

## FRONTEND-ONLY MODE (no backend yet — critical)
- ZERO network code: no fetch/axios/server actions/WebSocket clients anywhere. If you
  catch yourself calling an API endpoint — don't; read the local mock file instead.
- All data comes from typed local mock files (`src/data/*.ts`, shapes per §8), ≥10
  records per dataset — extend them, never fork them.
- Route every read/write through a small service layer (`src/services/*.ts`) with the
  exact function signatures the future REST/socket API will have (getPositions(),
  placeOrder(), createSchedule(), requestWithdrawal()…). TanStack Query consumes only
  these services — when the backend is wired later, only the service files change,
  zero page code touched.
- Live feel without a server: a local tick simulator (random-walk around mock prices,
  ~1s interval) drives the ticker marquee, quotes and tick-flashes; 300–800ms fake
  latency inside the services makes skeletons and optimistic states visible.
- Broker/API sections (A-4 broker connect, T-9 account linking, T-10/T-11 deposit &
  withdrawal rails, webhook/callback-URL config, AI co-pilot actions) are built to
  the last field — forms, validation, capability matrix, status badges — but their
  final submit calls NOTHING: it resolves to a designed, clearly-labeled state
  ("Ready — executes when the backend is connected" / SIMULATED badge on paper
  accounts). Every such control still gives visible feedback: never a dead button,
  and never a fake "Connected to Exness" success claim.
- Paper-account trading DOES fully simulate locally: Place Trade → pending → fill
  with ref OST-2025-XXXXX → positions update → Records journal entry. The product
  must feel alive even though everything is local.

## DESIGN SYSTEM (locked — do not improvise)
- Modern dark terminal aesthetic: flat, confident, restrained. **No gradients** on
  buttons, cards, or sections — depth comes from 1px hairlines, soft shadows, and
  spacing. At most one subtle radial glow behind a hero.
- Colors (CSS variables only, never raw hex in .tsx):
  surfaces `--surface-0 #0b0f1a` · `--surface-1 #121828` · `--surface-2 #1a2236` ·
  `--surface-3 #24304a`, hairline `rgba(148,163,184,.14)`; brand orange `#f97316`,
  quote cyan `#22d3ee`, up/buy `#22c55e`, down/sell `#ef4444`, warning `#f59e0b`,
  AI violet `#a855f7`; text `#e6edf7` / `#94a3b8` / `#64748b`.
- Type: Space Grotesk for headings, Inter for UI, JetBrains Mono with `tabular-nums`
  for EVERY price, P&L, size, and percentage — columns must align, flashes must not jitter.
- Motion: 160–240ms ease-out only; hover-lift on cards; count-up on KPIs; signature
  tick-flash (green/red 500ms) on live price changes; `.os-pulse` on live indicators.
  Everything honors `prefers-reduced-motion` (snap instead of count-up, no flash,
  no marquee).

## QUALITY BAR — a page is DONE only when ALL are true
1. **Zero dead ends.** Every button, link, tab, nav item, row action, and form either
   navigates to a real route or fires a visible action (state change + ONE toast).
   No `href="#"`, no empty `onClick`, no decorative dropdowns, no disabled dead UI,
   no "coming soon".
2. **No blank anything.** No blank screens, blank redirects, or empty sections.
   Loading = skeletons; error = designed error panel with Retry; empty = designed
   empty state with a working CTA.
3. **Zero errors.** No console errors, zero network requests fired (frontend-only
   phase), `npm run build` + typecheck pass, page renders correctly at 1440 / 768 /
   360px, and every `<Link to>` target exists in the route tree.
4. **Real-feeling data.** ≥10 records per dataset on the page: real symbols (EURUSD,
   XAUUSD, BTCUSDT, US30, Deriv R_10 / Volatility indices), real broker fields (MT5
   login + server, Deriv API token, MetaApi account id), believable balances,
   timestamps, order refs (OST-2025-00123). Never lorem ipsum, never "John Doe".

## WORKING PROTOCOL — one page per turn
- I name the page (first: H-1). Build ONLY that page. Do not build future pages
  "while you're at it".
- BEFORE writing code: re-read that page's spec in `ostradeMO.md` (e.g. "PAGE H-1")
  plus §2 tokens; then re-read `src/styles/tokens.css` and one already-built page's
  stylesheet for consistency. Reuse shared components — never duplicate or restyle them.
- If scaffolding doesn't exist yet (tokens.css, app shell, marketing nav, mock data
  files per §8), create it as part of H-1, then build the page.
- Nav/footer links to pages not built yet must still resolve: create a tiny designed
  stub route (page name + "opens in a later step" + link home). Never a 404, never
  blank. Replace stubs as real pages arrive.
- When the page passes the quality bar: run the build, fix everything, then STOP and
  reply with a 3-line report (what was built · files created · verification results).
  Wait for my "next" instruction.

## OSTRADE RULES (apply wherever relevant)
- Global account switcher (Paper / Deriv / Exness) lives in the top bar; every trading
  surface reflects the active account — balance, currency, leverage, open positions.
- Core flow is the Signal Desk: paste signal → parsed order card (symbol, side, entry,
  SL, TP, lots) → the user may edit every field → pick account → Place Trade with an
  explicit confirm. The user's manual edits always win over the signal. Paper fills
  simulate locally; live-broker submits stop at the labeled "connects later" state.
- Scheduler: 20-at-a-go bulk paste; cap = MAX_SCHEDULES (default 50); UI always shows
  "n / 50 slots" and blocks the overflow with a clear message, never silently.
- Every action (manual, signal, scheduled, deposit, withdrawal) lands in Records with
  timestamp, account, and status.
- OStrade is a signal hub, not a broker-dashboard clone — charts are context, signals
  are the product.

## FIRST PAGE — H-1 (Landing, `/`)
Implement every section from `ostradeMO.md` "PAGE H-1": navbar (logo · Brokers ·
How it works · Login · Sign Up) → hero ("Your signals. Every broker. One click." +
dual CTA + live ticker marquee (local tick simulator, no APIs): EURUSD, BTCUSDT,
XAUUSD, R_10) → trust bar (Deriv
WebSocket API · Exness via MetaApi · Alpaca Paper · AES-256 credential vault) →
3 feature cards (Signal Desk / Automation / Broker Hub) → signal-to-trade strip
(Signal → Parser → Risk guard → Broker adapter → Fill receipt) → CTA + footer with
mandatory risk disclosure. All CTAs route to real routes (stub what isn't built yet).
Set up the theme scaffolding (tokens.css, app shell, marketing nav) as part of H-1,
verify against the quality bar, report, and stop.
