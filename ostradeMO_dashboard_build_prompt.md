# OStrade — Dashboard Pages Build Prompt (T-1 → T-16)

Paste into Claude **after** `ostradeMO_build_prompt.md`. It builds the 16 trader-dashboard
pages one per turn, starting with T-1. The first prompt's STACK, DESIGN SYSTEM,
FRONTEND-ONLY MODE, and QUALITY BAR all still apply — obey them throughout. New focus
for the dashboard: deep overlay density, multi-step wizards, and seamless URL wiring.

## SCOPE
Build pages T-1 → T-16 (routes `/dashboard` … `/dashboard/settings`), in index order,
one per turn. Each implements ALL 7 sections from its `ostradeMO.md` spec, mounted
inside the shared **DashboardShell**: sticky top bar (logo · AccountPill context
switcher · session clocks · notifications bell · KILL SWITCH · profile) + 16-item
sidebar (active route highlighted). Reuse the §7 shared components — `Drawer`,
`Stepper`, `OTPInput`, `ReceiptsPanel`, `ApprovalGate`, `KillSwitchButton`, `DataTable`,
`StatCard`, `BrokerBadge`, `QuoteCell`, `TriggerBadge`, `SourceBadge`, `EmptyState`,
`ChartWrapper` — never rebuild them.

## INTERACTION DENSITY — ≥15 overlays per page
Every dashboard page ships AT LEAST 15 of: drawers, multi-step wizards (Stepper),
multi-step modals, confirm dialogs, per-row Actions menus, and tab/mini-tab groups.
No decorative dropdowns, no dead buttons, no "coming soon".

- **Drawers** (slide-in right on lg+, full-screen on sm) = the detail spine, each with
  tabs: Position Detail (Overview · Chart · Modify · Attribution · Journal), Signal
  Detail (raw · parsed · execution · attribution · guard log), Schedule Detail (config
  · calendar · execution log · stats), Account Detail (Overview · Symbols · Health ·
  Finance · Sync · Audit), Symbol Detail (specs · ticks · where-tradeable), Trade-Record
  Detail (lifecycle · fills · ledger · journal), AI-Action Detail (tool call · args ·
  approval · refs), Broker-Health Detail.
- **Multi-step wizards (Stepper)**: Broker Connect (T-9 S2: broker→creds→test→2FA→save
  →sync), Schedule Builder (T-6 S4 by trigger type), Rule Builder (T-5 S3: Trigger→
  Conditions→Actions→Guards), Deposit Builder (T-10 S3), Withdrawal Builder + safety
  ladder (T-11 S3: account→rail→amount→destination→2FA→OTP→cooling→execute), Transfer
  Builder (T-12 S2: from→to→amount→rail→preview→2FA→execute), Alert-Rule Builder
  (T-15 S4), Reconciliation / Drift-Resolution wizard (T-12 S7), AI one-click Install
  (T-13 S3: preview→confirm→created).
- **Multi-step modals**: Confirm-Execute with typed "EXECUTE" gate above fat-finger
  threshold (T-3 S6, T-4 S3); Kill-Switch confirms — PAUSE / CLOSE-ALL / FULL LOCKDOWN
  (T-14 S3 + top-bar button); Override-with-reason (T-14 S4 pre-trade, T-4 S7 dedupe/
  storm — allowed only where the rule permits, never on circuit-breakers); AI Approval
  Gate (T-13, T-1 S5 inline Approve/Dismiss); Credential Reveal + OTP (T-16 S2 secrets,
  T-9 S5); Whitelist-Add + 24h-hold notice (T-11 S5); Test-Send per channel (T-15 S7);
  Feature-flag / guardrail edit → 2FA (T-16 S7, T-14 S2); Delete/Revoke confirms with
  reason (close position, close-all, reverse, schedule/rule/account delete, session
  revoke, secret rotation, broker disable, account soft-delete).
- **Per-row Actions dropdowns** on every table — real working items only (View · Edit ·
  Modify SL/TP · Partial close · Reverse · Close · Pause/Resume · Run now · Duplicate ·
  Re-execute · Schedule · Journal note · Retry · Mute source · Export row). Capability-
  gated: where a broker can't do it (e.g. Deriv can't modify SL), show a guidance note
  instead of a dead control — never an empty/disabled button.
- **Tabs + mini-tabs**: status filters (All/Pending/Filled/Rejected…), asset-class
  tabs, account/scope tabs, period selectors (1D/1W/1M/3M/ALL), drawer sub-tabs.

## SEAMLESS URL WIRING — every link is a real, shareable route
- Sidebar, top bar, and cross-page CTAs ("All positions →", "→ T-6 prefilled", "→ T-15",
  attribution deep-links in T-7/T-8 to the originating signal/rule/schedule/AI record)
  all use typed `<Link to>` targets that exist in the route tree. Zero `href="#"`,
  zero dead redirects, zero orphan routes.
- **Deep-linkable overlays**: opening a drawer or wizard writes to the URL (TanStack
  Router search params or nested route, e.g. `/dashboard/positions?pos=OST-POS-1042`,
  `/dashboard/signals?sig=OST-SIG-8823&exec=1`, `/dashboard/scheduler?build=price`).
  Back button closes the overlay; reload restores it; the link is shareable. Every
  drawer and wizard is reachable this way.
- **Cross-page prefilled flows** carry state via search params: T-1/T-2 "Create guard
  schedule around event" → `/dashboard/scheduler?build=session&symbol=…&window=…`;
  T-2/T-3 "Trade →" → `/dashboard/trade?symbol=…&accounts=…`; T-3 "Schedule this" →
  `/dashboard/scheduler?build=one_time&…`; T-1 AI proposal Approve →
  `/dashboard/trade?prefill=…`; T-7/T-8 attribution chips → open the source drawer on
  T-4/T-5/T-6/T-13 via `?open=<ref>`. Destination loaders read the params and prefill.
- **Account context in the URL**: pages scoped by account reflect it
  (`/dashboard/positions?account=exness-live-1`) so switching accounts (contextStore)
  is seamless, persists, and is shareable. LIVE/PAPER global mode persists too.
- **Breadcrumbs** on sub-pages (Markets / Trade Ticket / Signal Desk / Scheduler /
  Records / Accounts / Deposits / Withdrawals / Transfers / Co-Pilot / Risk /
  Notifications / Settings) for orientation.

## FRONTEND-ONLY REMINDER (dashboard-specific)
- All overlays function locally: paper-account trades/schedules/rules/ledger simulate
  end-to-end via `src/services/*` (refs OST-2025-XXXXX, row-flash, journal entries,
  ledger postings). Live-broker and finance/API submits resolve to the labeled "Ready —
  connects when the backend is wired" / SIMULATED state — never a fake "Connected to
  Exness", never a dead button.
- Kill switch flips local state, toasts, and broadcasts to other open tabs
  (BroadcastChannel or storage event) — no server.
- Tick simulator drives every QuoteCell/PriceFlash, the marquee, and tick-flash on
  P&L; 300–800ms fake latency in services so skeletons and optimistic states show.

## PER-PAGE OVERLAY FLOOR (≥15 each — headline overlays to include; add more if natural)
- **T-1 Command Center**: adapter-health drawer · per-account sparkline drawer ·
  position detail drawer · alert detail modal · create-guard-schedule wizard(prefill) ·
  AI proposal approve modal · kill-switch confirm · per-account kill · market-clock
  detail · economic-event detail · notification-center drawer · quick-trade modal ·
  session-clock legend · portfolio range modal · export-snapshot modal.
- **T-2 Markets**: symbol detail drawer · add-to-watchlist modal · trade-prefill link ·
  chart-indicators modal · timeframe selector · asset-class tabs · economic-event guard
  wizard · price-alert wizard(prefill) · hot-symbol detail · spread-compare modal ·
  broker-overlay note · watchlist reorder drawer · search-results modal · session legend
  · export-watchlist modal.
- **T-3 Trade Ticket**: account-multi-select drawer · instrument-search modal · size-
  allocation editor · SL/TP mode modal · bracket-preview modal · risk-preview expand ·
  guardrail-violation modal(override+reason) · Deriv-contract builder modal · confirm-
  execute multi-step(type EXECUTE) · receipts panel · retry-rejected modal · repeat-
  ticket modal · schedule-this wizard(prefill) · keyboard-shortcuts modal · recent-
  ticket detail drawer.
- **T-4 Signal Desk**: parser live-preview · execution confirm multi-step · signal
  detail drawer · copy-trade import wizard · source-mute modal · dedupe-override
  modal(reason) · storm-override modal · re-execute confirm · schedule-from-signal
  wizard(prefill) · journal-note modal · source-leaderboard detail · webhook-rotation
  modal · sample-chip try · quarantine-detail modal · bulk-stage modal.
- **T-5 Automation**: rule builder wizard(4-step) · condition-library insert modal ·
  action-mapping preview · dry-run config modal · promote-to-live confirm(2FA) · rule
  detail drawer · duplicate-rule modal · rule audit drawer · advanced JSON editor ·
  guards editor · source-picker modal · per-rule kill confirm · delete-rule confirm ·
  simulation report modal · export-rules modal.
- **T-6 Scheduler**: schedule builder drawer-wizard(per trigger) · bulk-paste builder
  modal(20-at-a-go preview) · schedule detail drawer(tabs) · calendar dot popover ·
  drag-reschedule confirm · run-now confirm · pause/resume · duplicate · delete-confirm
  · next-24h detail popover · execution-log drawer · export-csv · expiry editor ·
  indicator-condition modal · cap-block modal(overflow at 50, no silent fail).
- **T-7 Positions**: position detail drawer(5 tabs) · modify SL/TP modal · partial-
  close modal · reverse confirm · close confirm · bulk-action confirm(per-broker list)
  · trail-SL modal · scale-out modal · margin-detail drawer · Deriv-contract sell
  modal · breakeven-buffer modal · exposure-breakdown modal · source-attribution deep-
  link · close-all-by-filter modal · alerts-threshold editor.
- **T-8 Records**: trade detail drawer · attribution drilldown · source mute/pause deep-
  link · statement-import wizard · reconciliation exception modal · accept/keep/flag
  actions · export-center job modal · journal editor drawer · screenshot-upload modal ·
  lesson-digest config · column-chooser · range-selector · PDF-preview modal · KRA-
  export config · symbol-heat detail.
- **T-9 Accounts**: add-broker wizard · account detail drawer(6 tabs) · adapter-
  diagnostics drawer · reconnect confirm · refresh-symbols · run-diagnostics modal ·
  symbol-map editor row · AI-mapper accept modal · context-switcher confirm · LIVE/
  PAPER toggle confirm · audit-log drawer · credential-reveal+OTP · rotate-secret
  confirm · disable-broker confirm · sync-backfill modal.
- **T-10 Deposits**: deposit builder drawer(steps) · rail-picker · paymentagent agent-
  picker modal · crypto address+QR modal · confirmations tracker · manual proof-upload
  modal · review+fees modal · Deriv cashier iframe modal · failed-recovery modal ·
  broker-support deep-link · history detail drawer · ledger-entry deep-link ·
  whitelist-confirm modal · export-csv · rail-config modal.
- **T-11 Withdrawals**: withdrawal builder drawer+safety ladder · destination picker ·
  whitelist-add+24h-hold modal · network-fee compare · test-withdrawal nudge · cooling-
  period notice · OTP verify · 2FA TOTP · history detail drawer · receipt-PDF modal ·
  safety-controls editor(2FA) · cap-edit · disable-while-paused confirm · broker-
  support link · reverse confirm.
- **T-12 Transfers**: transfer builder wizard · two-leg checklist modal · FX-preview ·
  2FA confirm · combined-receipts · ledger drilldown drawer · adjustment-post
  wizard(reason) · drift-detail · reconcile-now modal · statement generator modal ·
  audit-HMAC export · funding-rail editor(2FA) · imbalance banner detail · per-account
  reconcile drawer · transfer-detail drawer.
- **T-13 Co-Pilot**: chat tool-call chip detail · AI proposal card(approve/dismiss) ·
  one-click install preview modal · confirm-create · symbol-mapper batch modal · daily-
  briefing settings · anomaly detail with evidence · auto-mitigate toggle confirm ·
  approval-policy editor · standing-approval(2FA) · activity-log drawer · tool-scope
  editor · regenerate-briefing · template-detail · deep-link to created refs.
- **T-14 Risk**: kill-switch PAUSE/CLOSE-ALL/LOCKDOWN confirms · per-account kill ·
  per-rule kill · guardrail-edit(2FA) · pre-trade-check checklist modal · override-with-
  reason · fat-finger confirm · storm-quarantine detail · session-limits editor · stop-
  for-today confirm · reality-check modal · risk-audit drawer · export · circuit-
  breaker config · override-policy editor.
- **T-15 Notifications**: event×channel matrix cell editor · alert-rule builder wizard ·
  alert-detail drawer · mute-class confirm · telegram pairing modal · command-reference
  modal · per-chat scope editor · digest preview modal · digest-settings · quiet-hours
  editor · rate-limit editor · test-send-per-channel modal · delivery-proof drawer ·
  snooze · bulk-mark-read confirm.
- **T-16 Settings**: profile-change OTP · password-change gate · 2FA re-enroll/recovery
  · session-revoke confirm · webhook secret reveal+OTP · rotation confirm · outbound-
  webhook test-fire · API-token create/rotate/revoke(scopes) · appearance live-preview
  · locale-change confirm · broker-defaults editor · symbol-suffix override · feature-
  flag toggle(2FA) · data-export job modal · delete-account multi-step(2FA+typed) ·
  consent-log drawer · integration credential editor.

## WORKING PROTOCOL — one page per turn
- I name the page (first: T-1). Build ONLY that page. Do not build future pages
  "while you're at it".
- BEFORE writing code: re-read that page's spec in `ostradeMO.md` (e.g. "PAGE T-6") +
  §2 tokens + §7 shared components + §8 query keys; then re-read `src/styles/tokens.css`,
  the DashboardShell, and one already-built dashboard page for consistency. Reuse shared
  components; never duplicate or restyle them.
- If the DashboardShell / top bar / sidebar / shared primitives don't exist yet, create
  them as part of T-1, then build the page.
- Cross-page links to pages not built yet must still resolve: tiny designed stub route
  ("opens in a later step" + link back) per the first prompt. Never a 404, never blank.
- Wire every overlay to the URL (deep-linkable), every cross-page CTA to a typed route
  with prefilled search params, every table row to a working Actions menu + detail
  drawer, every destructive/money action to a confirm (reason where the outline says).
  Frontend-only: paper simulates live; live-broker/API submits end in the labeled
  "connects later" state.
- When the page passes the QUALITY BAR: run the build, fix everything, then STOP and
  reply with a 4-line report (page built · overlays shipped with counts · URL-deep-
  links wired · verification results incl. zero-network + 360px + reduced-motion). Wait
  for my "next" instruction.

## FIRST DASHBOARD PAGE — T-1 Command Center (`/dashboard`)
Implement all 7 sections from `ostradeMO.md` "PAGE T-1": build the DashboardShell
(sticky top bar with AccountPill + KillSwitchButton + notifications bell, 16-item
sidebar) → S1 status ribbon (adapter health chips → T-9 drawer) → S2 KPI row (6,
count-up, tick-flash) → S3 equity curve + per-account sparklines (deep-link to T-9) →
S4 live positions snapshot (tick-flash, → T-7 detail drawer via URL param) → S5
automation board (3 mini-panels → T-6/T-5/T-13, AI proposal inline Approve/Dismiss
modal) → S6 alerts & action center (each → deep-link) → S7 market clocks + economic
calendar (event → create-guard-schedule wizard prefilled to T-6). Ship ≥15 overlays per
the floor above, wire every link to a real route, verify, report, and stop.
