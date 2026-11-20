# T-5: Signal Automation Engine

The automation engine lives at `/dashboard/automation`. The existing single-file preview also serves `/#/dashboard/automation`; the Start target serves `/dashboard/automation`. The bare preview URL opens this workspace.

## Build and verification

```sh
npx tsc --noEmit
node --test tests/automation.test.mjs
node --test tests/signal-desk.test.mjs
npm run build
npx vite build --config start.vite.ts   # Node 22.12+ static Start shell
```

The standard `npm run build` produces the self-contained `dist/index.html`. The Start static target outputs `dist-start/client/`; deploy it with an `index.html` fallback. The Start server bundle exists only to prerender the shell. No server process is required for this page.

## Page layout

1. **Automation overview.** Four KPIs (active rules, processed, executed, guard blocks), a snapshot-only engine strip, and the most recent decision with a direct audit link.
2. **Rule registry.** Twelve shared seeded rules cover active, paused, and draft states. Search, state and source filters, sorting, pagination, 30-rule cap, inline activation toggle, edit, duplicate, dry-run, and delete confirmation all use local services.
3. **Four-step rule builder.** Name and approve sources; compose conditions; map accounts, sizing, and stops; set hourly, position, loss, and duplicate limits. Conditions are shown as an IF/THEN summary while editing.
4. **Action mapping preview.** Replays the latest desk signals through the draft and lists `WOULD EXECUTE`, `WOULD SKIP`, and `BLOCKED` decisions with reasons and per-account sizing, stop conversions, and the simulated/preview mode.
5. **Condition library.** Twelve documented, insertable conditions. Advanced mode edits a strict JSON policy validated against a Zod schema before it can be applied.
6. **Dry run.** A 1-, 7-, or 30-day replay against stored signals, with evaluated counts, guard hits, hypothetical P&L, and per-account allocation. It never creates an order or changes positions. The report and operator action are logged.
7. **Audit log.** Searchable, filterable rule evaluations with decision, reason, refs, latency, and a locally generated CSV export.
8. **Safety.** The kill switch, loss breaker, burst/position limits, a seven-step pre-trade checklist, and a confirmed pause-all operator action.
9. **Readiness.** A live pre-flight checklist tied to the draft: trigger, bounded risk, mapped targets, dry-run evidence, kill-switch state, and execution boundary.

## Persistence and execution boundaries

Rules are created or updated through `src/services/dashboard.ts`, so they remain the same rules summarized in T-1 and used by the Signal Desk. Parsing, previews, dry runs, and rule state are local and synchronous from the page's perspective (with simulated service latency).

The module store is in memory for the current application session. A page reload restores the seeded dataset, consistent with the rest of the cockpit, unless a backend is later connected. There is no `fetch`, XHR, WebSocket, or third-party automation client in this codebase.

No rule can place a live broker order. Paper accounts remain simulated. Any broker target resolves to a clearly labelled preview. The global kill switch always blocks activation and preview decisions when engaged. Rule changes and operator actions, including deletion and pause-all, are audited.
