import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useDashboardContext } from "@/context/DashboardContext";
import * as api from "@/services/settings";
import {
  Badge,
  Button,
  Feedback,
  Field,
  Panel,
  Select,
  Toggle,
  useSave,
} from "./SettingsUI";
type Pref = Awaited<ReturnType<typeof api.getSettingsPreferences>>;
export function Appearance({ data }: { data: Pref["appearance"] }) {
  const [v, set] = useState(data);
  const { setTheme } = useTheme();
  const m = useSave(
    api.saveAppearance,
    (r) => {
      setTheme(r.theme);
    },
    "preferences",
  );
  return (
    <Panel
      label="VISUAL PREFERENCES"
      title="Theme and density"
      copy="Theme applies to the workspace. The sample shows chart, number and price styling before you save."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(v);
        }}
      >
        <div className="os-st-form-grid">
          <Field label="Interface theme">
            <Select
              value={v.theme}
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "System"],
              ]}
              onChange={(theme) => set({ ...v, theme })}
            />
          </Field>
          <Field label="Accent density">
            <Select
              value={v.density}
              options={[
                ["comfortable", "Comfortable"],
                ["compact", "Compact"],
              ]}
              onChange={(density) => set({ ...v, density })}
            />
          </Field>
          <Field label="Chart theme">
            <Select
              value={v.chart}
              options={[
                ["dark", "Dark candles"],
                ["light", "Light candles"],
              ]}
              onChange={(chart) => set({ ...v, chart })}
            />
          </Field>
          <Field label="Number format">
            <Select
              value={v.numbers}
              options={[
                ["en-KE", "Kenya · 1,234.56"],
                ["en-US", "US · 1,234.56"],
                ["de-DE", "Germany · 1.234,56"],
              ]}
              onChange={(numbers) => set({ ...v, numbers })}
            />
          </Field>
          <Toggle checked={v.mono} onChange={(mono) => set({ ...v, mono })}>
            Use monospace prices
          </Toggle>
          <Toggle
            checked={v.motion === "reduce"}
            onChange={(on) => set({ ...v, motion: on ? "reduce" : "system" })}
          >
            Always reduce motion
          </Toggle>
        </div>
        <div className={`os-st-chart os-st-chart-${v.chart}`}>
          <div>
            <small>STATIC CHART SAMPLE</small>
            <strong className={v.mono ? "os-st-mono" : ""}>
              {new Intl.NumberFormat(v.numbers, {
                minimumFractionDigits: 2,
              }).format(10842.5)}
            </strong>
          </div>
          <div className="os-st-candles" aria-hidden="true">
            {[26, 39, 34, 52, 43, 58, 65, 53, 73, 64, 79, 82].map((n, i) => (
              <i key={i} style={{ height: `${n}%` }} />
            ))}
          </div>
        </div>
        <Feedback
          error={m.error}
          pending={m.isPending}
          note={m.data ? "Appearance preferences saved." : undefined}
        />
        <Button kind="primary" type="submit" disabled={m.isPending}>
          Save appearance
        </Button>
      </form>
    </Panel>
  );
}
export function Locale({ data, rate }: { data: Pref["locale"]; rate: number }) {
  const [v, set] = useState(data),
    m = useSave(api.saveLocale, undefined, "preferences");
  const sample = new Intl.DateTimeFormat("en-GB", {
    timeZone: v.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date("2025-11-20T08:30:00Z"));
  return (
    <Panel
      label="FORMATS & UNITS"
      title="Display preferences"
      copy="USD remains native. Locale settings are previewed here; existing schedule and digest cutoffs stay in EAT in this frontend demo."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(v);
        }}
      >
        <div className="os-st-form-grid">
          <Field label="Display currency">
            <Select
              value={v.currency}
              options={["USD", "KES"]}
              onChange={(currency) => set({ ...v, currency })}
            />
          </Field>
          <Field label="Timezone">
            <Select
              value={v.timezone}
              options={api.timezones}
              onChange={(timezone) => set({ ...v, timezone })}
            />
          </Field>
          <Field label="Trade size">
            <Select
              value={v.size}
              options={["Lots", "Units"]}
              onChange={(size) => set({ ...v, size })}
            />
          </Field>
          <Field label="P&L format">
            <Select
              value={v.pnl}
              options={["Amount", "Percent"]}
              onChange={(pnl) => set({ ...v, pnl })}
            />
          </Field>
          <Field label="Week starts on">
            <Select
              value={v.week}
              options={["Monday", "Sunday"]}
              onChange={(week) => set({ ...v, week })}
            />
          </Field>
          <Field label="Date format">
            <Select
              value={v.date}
              options={["Day first", "ISO"]}
              onChange={(date) => set({ ...v, date })}
            />
          </Field>
        </div>
        <div className="os-st-note">
          <strong>
            {v.currency === "KES"
              ? `KES ${(100 * rate).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
              : "USD 100.00"}{" "}
            ·{" "}
            {v.pnl === "Percent"
              ? "+2.50%"
              : v.currency === "KES"
                ? `+KES ${(2.5 * rate).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
                : "+USD 2.50"}{" "}
            · {v.size === "Units" ? "10,000 units" : "0.10 lots"}
          </strong>
          <span>
            {v.date === "ISO"
              ? new Intl.DateTimeFormat("sv-SE", {
                  timeZone: v.timezone,
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date("2025-11-20T08:30:00Z"))
              : sample}{" "}
            · {v.timezone} · Week starts {v.week}
          </span>
          <span>
            KES conversion uses a fixed demo rate: {rate} KES per USD. No daily
            rate feed or live conversion.
          </span>
        </div>
        <Feedback
          error={m.error}
          pending={m.isPending}
          note={m.data ? "Locale preferences saved." : undefined}
        />
        <Button kind="primary" type="submit" disabled={m.isPending}>
          Save locale
        </Button>
      </form>
    </Panel>
  );
}
export function Brokers({
  data,
}: {
  data: Awaited<ReturnType<typeof api.getSettingsBrokers>>;
}) {
  const [v, set] = useState(data.preferences),
    [map, setMap] = useState({ accountId: "", canonical: "", suffix: "" });
  const c = useQueryClient(),
    ctx = useDashboardContext();
  const save = useSave(
      api.saveBrokerDefaults,
      () => void c.invalidateQueries({ queryKey: ["broker-defaults"] }),
      "brokers",
    ),
    vis = useSave(
      api.setBrokerVisibility,
      () => {
        for (const key of [
          "accounts",
          "broker-defaults",
          "hub-adapters",
          "account-finance",
          "funding-accounts",
          "withdrawal-accounts",
          "transfer-accounts",
          "copilot-accounts",
          "risk-overview",
          "risk-sessions",
          "notifications",
        ])
          void c.invalidateQueries({ queryKey: [key] });
      },
      "brokers",
    ),
    mapping = useSave(
      api.saveSettingsMapping,
      () => {
        for (const key of [
          "account-mappings",
          "symbol-mappings",
          "account-detail",
        ])
          void c.invalidateQueries({ queryKey: [key] });
      },
      "brokers",
    );
  const accounts = [
    ["", "Choose at order entry"],
    ...data.accounts.map((a) => [a.id, a.label]),
  ] as [string, string][];
  const account = data.accounts.find((a) => a.id === map.accountId);
  const symbols = [
    ["", "Choose instrument"],
    ...data.symbols
      .filter((s) => account && s.brokerSymbols[account.broker])
      .map((s) => [s.canonical, s.canonical]),
  ] as [string, string][];
  return (
    <div className="os-st-grid">
      <Panel
        label="ORDER DEFAULTS"
        title="Account and adapter defaults"
        copy="Saved locally for workspace review. Remote adapter fields do not connect or sync an account."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              ...v,
              manual: accounts.some((a) => a[0] === v.manual) ? v.manual : "",
              signals: accounts.some((a) => a[0] === v.signals)
                ? v.signals
                : "",
              schedules: accounts.some((a) => a[0] === v.schedules)
                ? v.schedules
                : "",
            });
          }}
        >
          <div className="os-st-form-grid">
            {(
              [
                ["manual", "Manual trading account"],
                ["signals", "Signal account"],
                ["schedules", "Schedule account"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <Select
                  value={accounts.some((a) => a[0] === v[k]) ? v[k] : ""}
                  options={accounts}
                  onChange={(val) => set({ ...v, [k]: val })}
                />
              </Field>
            ))}
            <Field label="Default time in force">
              <Select
                value={v.tif}
                options={api.tif}
                onChange={(tif) => set({ ...v, tif })}
              />
            </Field>
            <Field label="Market slippage tolerance (pips)">
              <input
                type="number"
                className="form-control"
                required
                min={0}
                max={100}
                step="0.1"
                value={v.slippage}
                onChange={(e) =>
                  set({ ...v, slippage: e.target.valueAsNumber || 0 })
                }
              />
            </Field>
            <Field label="Deriv app ID">
              <input
                className="form-control"
                inputMode="numeric"
                pattern="[0-9]{0,10}"
                value={v.appId}
                onChange={(e) => set({ ...v, appId: e.target.value })}
              />
            </Field>
            <Field label="Deriv branding">
              <input
                className="form-control"
                maxLength={60}
                placeholder="Workspace label"
                value={v.brand}
                onChange={(e) => set({ ...v, brand: e.target.value })}
              />
            </Field>
            <Field label="MetaApi region">
              <Select
                value={v.region}
                options={["london", "new-york", "singapore"]}
                onChange={(region) => set({ ...v, region })}
              />
            </Field>
            <Field label="Maximum history backfill (days)">
              <input
                className="form-control"
                type="number"
                min={1}
                max={365}
                required
                value={v.backfill}
                onChange={(e) =>
                  set({ ...v, backfill: e.target.valueAsNumber || 0 })
                }
              />
            </Field>
          </div>
          <Feedback
            error={save.error}
            pending={save.isPending}
            note={save.data ? "Broker defaults saved locally." : undefined}
          />
          <Button type="submit" kind="primary" disabled={save.isPending}>
            Save broker defaults
          </Button>
        </form>
      </Panel>
      <div className="os-st-columns">
        <Panel
          label="ADAPTER VISIBILITY"
          title="Available brokers"
          copy="Hidden adapters are removed from account selectors. Historical activity and credentials are preserved."
        >
          <div className="os-st-options">
            {data.adapters.map((a) => (
              <Toggle
                key={a.id}
                checked={a.enabled}
                disabled={a.id === "paper" || vis.isPending}
                onChange={(enabled) => {
                  if (!enabled) {
                    if (
                      data.accounts.some(
                        (r) =>
                          r.id === ctx.activeAccountId && r.broker === a.id,
                      )
                    )
                      ctx.setActiveAccountId("all");
                    ctx.setFanoutAccountIds(
                      ctx.fanoutAccountIds.filter(
                        (id) =>
                          !data.accounts.some(
                            (r) => r.id === id && r.broker === a.id,
                          ),
                      ),
                    );
                  }
                  vis.mutate({ broker: a.id, enabled });
                }}
              >
                {a.label}
              </Toggle>
            ))}
          </div>
          <Feedback
            error={vis.error}
            pending={vis.isPending}
            note={vis.data?.message}
          />
        </Panel>
        <Panel
          label="CANONICAL SYMBOL MAP"
          title="Account suffix override"
          action={
            <Link className="os-st-link" to="/dashboard/accounts">
              Broker Hub
            </Link>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mapping.mutate(map);
            }}
          >
            <div className="os-st-form-grid">
              <Field label="Mapping account">
                <Select
                  value={map.accountId}
                  options={accounts.map(([id, name]) => [
                    id,
                    id ? name : "Choose account",
                  ])}
                  onChange={(accountId) =>
                    setMap({ accountId, canonical: "", suffix: "" })
                  }
                />
              </Field>
              <Field label="Canonical instrument">
                <Select
                  value={map.canonical}
                  options={symbols}
                  onChange={(canonical) => setMap({ ...map, canonical })}
                />
              </Field>
              <Field label="Broker suffix">
                <input
                  className="form-control"
                  placeholder="e.g. .raw"
                  maxLength={12}
                  value={map.suffix}
                  onChange={(e) => setMap({ ...map, suffix: e.target.value })}
                />
              </Field>
            </div>
            <Feedback
              error={mapping.error}
              pending={mapping.isPending}
              note={
                mapping.data
                  ? `Saved ${mapping.data.canonical} → ${mapping.data.brokerSymbol} to the shared mapping.`
                  : undefined
              }
            />
            <Button
              type="submit"
              disabled={!map.accountId || !map.canonical || mapping.isPending}
            >
              Save symbol mapping
            </Button>
          </form>
          {!!data.mappings.length && (
            <p className="os-st-small">
              {data.mappings.length} shared override(s).{" "}
              {data.mappings
                .filter((r) => r.accountId === map.accountId)
                .slice(0, 3)
                .map((r) => `${r.canonical} → ${r.brokerSymbol}`)
                .join(" · ")}
            </p>
          )}
        </Panel>
      </div>
      <div className="os-st-wide">
        <Badge tone="warn">External adapters · not connected</Badge>
      </div>
    </div>
  );
}
