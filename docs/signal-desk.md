# T-4: Signal Desk

The Signal Desk is at `/dashboard/signals`. The existing single-file preview also supports `/#/dashboard/signals`. The public home page remains at `/#/`; the bare preview entry now opens the T-5 Automation workspace.

## Run and build

```sh
npm install
npm run dev
npx tsc --noEmit
node --test tests/signal-desk.test.mjs
npm run build
```

The standard build retains the existing self-contained Vite application in `dist/index.html`.

For the **TanStack Start static SPA** target, use Node 22.12 or later:

```sh
npx vite --config start.vite.ts
npx vite build --config start.vite.ts
```

Deploy `dist-start/client/` with a static-host fallback to `index.html`. The server build is used only to prerender the HTML shell; no server process or broker backend is needed at runtime. T-4 is a typed file route in `src/routes/dashboard/signals.tsx`. Both build targets share the same React components, Query client, account context, and local services.

## Workspace

The nine sections are source channels, the signal composer, parsed order preview, signal inbox, execution routing, import center, execution receipts, source performance, and guard activity.

- Paste or drop plain text or TradingView JSON. The parser supports canonical symbols, aliases, broker suffixes, market/limit/stop orders, BUY/SELL and LONG/SHORT, Deriv stakes and durations, price/pip/percentage stops, and up to three scale-out targets.
- **Parse signal** records the message in the inbox. **Stage** holds it for later. **Review order** opens account selection and a leg-by-leg confirmation; parsing never executes an order.
- Edit the order before review. Manual edits survive re-parsing of the same message; replacing the input starts a separate draft.
- Select several staged or parsed inbox signals to review a batch. Size as signaled, use a fixed quantity, allocate equity, or size to a protective stop. Unavailable symbols, invalid stops, excessive spreads, and unsupported sizes produce explicit blocking reasons.
- Paper market fills update the shared positions and Records journal and receive `OST-2025-XXXXX` references. The trade confirmation is idempotent. Untriggered paper limits/stops remain pending; **Simulate trigger** explicitly replays the entry without changing the quote snapshot.
- Deriv and Exness/MT5 legs produce backend-required previews, not fills. Telegram, webhook, email, and CopyFactory settings are local demonstrations. The `.invalid` addresses are intentionally non-routable.
- CSV/TSV and HTML statement imports support a column mapper, an import preview, external ticket deduplication, and a 500-row limit. Uploaded content is read locally and never rendered as HTML.
- Open an inbox row for the raw message, complete order fields, account attribution, journal notes, re-execution, scheduling, or discard. A scheduled signal consumes a slot in the shared 50-slot scheduler.
- Configure duplicate, storm, and stale-price thresholds in Guard activity. An override needs a written reason, creates an audit entry, and returns the signal to staging. It never bypasses the order confirmation or position risk checks.

## Data boundaries

The canonical accounts, market symbols, signal samples, positions, and journal are reused rather than replicated. `src/data/signalDesk.ts` supplies typed desk-specific fixtures; `src/services/signalDesk.ts` owns all desk reads and writes. Prices are static. Mutations and parsing use local simulated latency, not HTTP or WebSocket clients.

Like the existing cockpit, trading data lives in memory for the current app session. Reloading restores the seeded snapshot. Browser theme and account preferences keep their existing persistence behavior. No credentials or uploaded statements are persisted.

## Verification

The reproducible service suite exercises parser grammar, template recognition, scaled risk sizing, multi-account receipts, idempotency, reasoned guard overrides, pending paper fills, CSV deduplication, and shared scheduler writes. Browser captures are in `artifacts/signal-desk-desktop.png` and `artifacts/signal-desk-mobile.png`.