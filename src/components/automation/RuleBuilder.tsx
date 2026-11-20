import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, FlaskConical, Loader2, Plus, Save, X, Zap } from "lucide-react";
import type { MarketSymbol } from "@/data/markets";
import { BrokerBadge, EnvPill } from "@/components/DashboardShell";
import type { AutomationSignal, PreviewRow, RuleDraft, TradingAccount } from "@/services/automation";
import { automationSourceOptions, previewDraft, summarizeAction, summarizeCondition } from "@/services/automation";
import { FieldError, InlineNotice, SourceBadge } from "./AutomationUI";

const STEPS = [
  { id: 1, title: "Trigger", hint: "Where signals arrive" },
  { id: 2, title: "Conditions", hint: "Which signals qualify" },
  { id: 3, title: "Actions", hint: "What the engine does" },
  { id: 4, title: "Guards", hint: "When it must stop" },
] as const;
type Step = 1 | 2 | 3 | 4;

function ToggleLine({ checked, onChange, label, detail, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string; disabled?: boolean }) {
  return <label className={`os-auto-toggle-line${checked ? " is-on" : ""}${disabled ? " is-locked" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span><b>{label}</b><small>{detail}</small></span>
    <i aria-hidden />
  </label>;
}

export function RuleBuilder({
  draft, setDraft, accounts, markets, samples, openPositions, halted, editing, saving, dryRunning,
  onSave, onRunDryRun, onCancel,
}: {
  draft: RuleDraft; setDraft: (draft: RuleDraft) => void; accounts: TradingAccount[]; markets: MarketSymbol[];
  samples: AutomationSignal[]; openPositions: number; halted: boolean; editing: boolean; saving: boolean; dryRunning: boolean;
  onSave: (activate: boolean) => void; onRunDryRun: () => void; onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [symbolInput, setSymbolInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => setDraft({ ...draft, [key]: value });
  const sourceOptions = automationSourceOptions;
  const symbolUniverse = markets.map((market) => market.canonical);
  const quickSymbols = ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSDT", "US30", "R_10", "NAS100", "ETHUSDT", "USDJPY", "NVDA"];
  const preview: PreviewRow[] = useMemo(() => previewDraft(draft, samples.slice(0, 20), accounts, openPositions, halted), [draft, samples, accounts, openPositions, halted]);
  useEffect(() => { setStep(1); setTouched(false); }, [draft.id]);
  const patchSymbol = (symbol: string) => {
    const value = symbol.trim().toUpperCase();
    if (!value || draft.symbols.includes(value)) return;
    set("symbols", [...draft.symbols, value]);
    setSymbolInput("");
  };
  const removeSymbol = (symbol: string) => set("symbols", draft.symbols.filter((entry) => entry !== symbol));
  const addChannel = () => {
    const value = channelInput.trim();
    if (!value || draft.channels.includes(value)) return;
    set("channels", [...draft.channels, value]);
    setChannelInput("");
  };
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 3) errors.name = "Use at least 3 characters.";
  if (!draft.sources.length) errors.sources = "Select at least one source.";
  if (!draft.accountIds.length) errors.accounts = "Select at least one target account.";
  if (!draft.symbols.length && draft.status === "active") errors.symbols = "Active rules need at least one instrument.";
  if (draft.sizeMode !== "signal" && (!Number.isFinite(draft.sizeValue) || draft.sizeValue <= 0)) errors.size = "Enter a positive size.";
  if (!Number.isFinite(draft.dailyLossPct) || draft.dailyLossPct <= 0 || draft.dailyLossPct > 20) errors.dailyLoss = "Use a percentage from 0.1 to 20.";
  const issueCount = Object.keys(errors).length;
  const executeCount = preview.filter((row) => row.decision === "EXECUTE").length;
  const skipCount = preview.length - executeCount;
  const selectedSymbol = draft.symbols[0] ? markets.find((market) => market.canonical === draft.symbols[0]) : undefined;
  const primaryAccount = accounts.find((account) => account.id === draft.accountIds[0]);
  const finishDryRun = () => { if (issueCount) { setTouched(true); return; } onRunDryRun(); };
  const save = (activate: boolean) => { if (issueCount) { setTouched(true); return; } onSave(activate); };

  return <section className="os-auto-panel os-auto-builder" id="builder" aria-labelledby="auto-builder-heading">
    <header className="os-auto-panel-head">
      <div>
        <span className="os-auto-eyebrow">03 · RULE BUILDER</span>
        <h2 id="auto-builder-heading">{editing ? "Edit automation rule" : "Create an automation rule"}</h2>
        <p>Build the IF/THEN logic once. Test it against your own signals before anything can run.</p>
      </div>
      <div className="os-auto-builder-meta">
        <span className={`os-auto-rule-state is-${draft.status === "active" ? "active" : "draft"}`}><i />{draft.status === "active" ? "Active" : "Draft"}</span>
        {editing && <button type="button" className="os-auto-text-button" onClick={onCancel}><X size={13}/> Close editor</button>}
      </div>
    </header>

    <div className="os-auto-builder-summary">
      <div><span className="os-auto-chip-label">IF</span><strong>{summarizeCondition(draft)}</strong></div>
      <ChevronRight size={16} aria-hidden />
      <div><span className="os-auto-chip-label is-then">THEN</span><strong>{summarizeAction(draft, accounts)}</strong></div>
    </div>

    <div className="os-auto-builder-body">
      <nav className="os-auto-steps" aria-label="Rule builder steps">
        {STEPS.map((item) => <button type="button" key={item.id} className={`${step === item.id ? "is-current" : ""}${step > item.id ? " is-complete" : ""}`} aria-current={step === item.id ? "step" : undefined} onClick={() => setStep(item.id)}>
          <span>{step > item.id ? <Check size={14}/> : item.id}</span><b>{item.title}</b><small>{item.hint}</small>
        </button>)}
      </nav>

      <div className="os-auto-step-content">
        {step === 1 && <div className="os-auto-step" aria-labelledby="auto-step-1">
          <div className="os-auto-step-head"><span>STEP 01</span><h3 id="auto-step-1">Name the trigger</h3><p>A rule needs a name and at least one approved source. New signals are parsed before the engine considers them.</p></div>
          <div className="os-auto-form-grid">
            <label className="os-auto-field os-auto-span-2">Rule name<input value={draft.name} maxLength={72} onChange={(event) => set("name", event.target.value)} placeholder="e.g. London Gold Breakouts"/>{touched && <FieldError>{errors.name}</FieldError>}</label>
            <label className="os-auto-field os-auto-span-2">Description <span>(optional)</span><input value={draft.description} maxLength={160} onChange={(event) => set("description", event.target.value)} placeholder="What should this rule protect or capture?"/></label>
            <div className="os-auto-field os-auto-span-2"><span>Approved signal sources</span><div className="os-auto-source-grid">{sourceOptions.map((source) => <button type="button" key={source.id} className={`os-auto-source-choice${draft.sources.includes(source.id) ? " is-on" : ""}`} aria-pressed={draft.sources.includes(source.id)} onClick={() => set("sources", draft.sources.includes(source.id) ? draft.sources.filter((item) => item !== source.id) : [...draft.sources, source.id])}><SourceBadge source={source.id} compact/><span><b>{source.name}</b><small>{source.hint}</small></span>{draft.sources.includes(source.id) && <Check size={14}/>}</button>)}</div>{touched && <FieldError>{errors.sources}</FieldError>}</div>
            <div className="os-auto-field os-auto-span-2"><span>Trusted channel or webhook key <em>(optional)</em></span><div className="os-auto-inline-input"><input value={channelInput} onChange={(event) => setChannelInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChannel(); } }} placeholder="e.g. Gold Desk VIP"/><button type="button" className="os-auto-secondary" onClick={addChannel}><Plus size={14}/> Add</button></div><div className="os-auto-tag-row">{[...draft.channels, "Gold Desk VIP", "FX Pulse Africa", "BTC 4H Alert"].filter((item, index, all) => all.indexOf(item) === index).map((channel) => <button type="button" key={channel} className={`os-auto-tag${draft.channels.includes(channel) ? " is-on" : ""}`} onClick={() => set("channels", draft.channels.includes(channel) ? draft.channels.filter((item) => item !== channel) : [...draft.channels, channel])}>{channel}{draft.channels.includes(channel) && <X size={11}/>}</button>)}</div><small>Leave empty to accept any channel from the selected sources.</small></div>
          </div>
          <InlineNotice>Only parsed signals reach this rule. The local workspace never connects to Telegram, email, or a provider stream.</InlineNotice>
        </div>}

        {step === 2 && <div className="os-auto-step" aria-labelledby="auto-step-2">
          <div className="os-auto-step-head"><span>STEP 02</span><h3 id="auto-step-2">Set the conditions</h3><p>Every condition must pass. The builder reports exactly which signals would be skipped and why.</p></div>
          <div className="os-auto-field"><span>Instrument allow-list <em>(blank means every mapped instrument)</em></span><div className="os-auto-tag-row">{draft.symbols.map((symbol) => <button type="button" key={symbol} className="os-auto-tag is-on" onClick={() => removeSymbol(symbol)}>{symbol}<X size={11}/></button>)}</div><div className="os-auto-inline-input"><input list="auto-symbols" value={symbolInput} onChange={(event) => setSymbolInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); patchSymbol(symbolInput); } }} placeholder="Add a symbol…"/><datalist id="auto-symbols">{symbolUniverse.map((symbol) => <option key={symbol} value={symbol}/>)}</datalist><button type="button" className="os-auto-secondary" onClick={() => patchSymbol(symbolInput)}><Plus size={14}/> Add</button></div><div className="os-auto-tag-row">{quickSymbols.filter((symbol) => !draft.symbols.includes(symbol)).slice(0, 6).map((symbol) => <button type="button" key={symbol} className="os-auto-tag" onClick={() => patchSymbol(symbol)}>+ {symbol}</button>)}</div>{touched && <FieldError>{errors.symbols}</FieldError>}</div>
          <div className="os-auto-condition-grid">
            <div className="os-auto-field"><span>Direction</span><div className="os-auto-seg w-100">{(['ANY', 'BUY', 'SELL'] as const).map((side) => <button type="button" key={side} className={draft.side === side ? "is-on" : ""} onClick={() => set("side", side)}>{side}</button>)}</div></div>
            <label className="os-auto-field">Session<select value={draft.session} onChange={(event) => set("session", event.target.value as RuleDraft["session"])}><option value="any">Any session</option><option value="sydney">Sydney · 00:00–09:00</option><option value="asia">Tokyo · 03:00–12:00</option><option value="london">London · 10:00–19:00</option><option value="newyork">New York · 16:00–01:00</option><option value="overlap">London–NY overlap</option><option value="custom">Custom EAT window</option></select></label>
            <label className="os-auto-field">Minimum confidence <span className="os-auto-value">{draft.minConfidence}%</span><input type="range" min={0} max={100} step={1} value={draft.minConfidence} onChange={(event) => set("minConfidence", Number(event.target.value))}/></label>
            <label className="os-auto-field">Maximum spread <span className="os-auto-input-suffix"><input type="number" min={0} step={0.1} value={draft.maxSpread} onChange={(event) => set("maxSpread", Number(event.target.value))}/><em>pts</em></span></label>
          </div>
          {draft.session === "custom" && <div className="os-auto-form-grid"><label className="os-auto-field">Start (EAT)<input type="time" value={draft.sessionStart} onChange={(event) => set("sessionStart", event.target.value)}/></label><label className="os-auto-field">End (EAT)<input type="time" value={draft.sessionEnd} onChange={(event) => set("sessionEnd", event.target.value)}/></label></div>}
          <div className="os-auto-toggle-grid">
            <ToggleLine checked={draft.requireSl} onChange={(value) => set("requireSl", value)} label="Require a stop-loss" detail="Hard guard — missing SL is blocked."/>
            <ToggleLine checked={draft.requireTp} onChange={(value) => set("requireTp", value)} label="Require a take-profit" detail="At least one exit target must be present."/>
            <ToggleLine checked={draft.marketOpenOnly} onChange={(value) => set("marketOpenOnly", value)} label="Market must be open" detail="Closed sessions are skipped before sizing."/>
          </div>
        </div>}

        {step === 3 && <div className="os-auto-step" aria-labelledby="auto-step-3">
          <div className="os-auto-step-head"><span>STEP 03</span><h3 id="auto-step-3">Map the action</h3><p>Choose where qualifying orders go and how their size and exits are converted.</p></div>
          <div className="os-auto-field"><span>Target accounts <em>(Paper fills are local; broker accounts stay in preview)</em></span><div className="os-auto-account-grid">{accounts.map((account) => {
            const mapped = draft.symbols.length === 0 || draft.symbols.some((symbol) => markets.find((market) => market.canonical === symbol)?.brokerSymbols[account.broker]);
            const selected = draft.accountIds.includes(account.id);
            return <label key={account.id} className={`os-auto-account${selected ? " is-on" : ""}${!mapped ? " is-unmapped" : ""}`}><input type="checkbox" checked={selected} onChange={() => set("accountIds", selected ? draft.accountIds.filter((id) => id !== account.id) : [...draft.accountIds, account.id])}/><span><BrokerBadge broker={account.broker} label={account.brokerName}/><EnvPill env={account.environment}/><b>{account.label}</b><small>{mapped ? `${selectedSymbol?.brokerSymbols[account.broker] ?? "Any symbol"} · ${account.leverage}` : "Symbol not offered on this account"}</small></span></label>;
          })}</div>{touched && <FieldError>{errors.accounts}</FieldError>}</div>
          <div className="os-auto-form-grid">
            <label className="os-auto-field">Allocation<select value={draft.allocation} onChange={(event) => set("allocation", event.target.value as RuleDraft["allocation"])}><option value="same">Same size for every account</option><option value="equity">Scale by account equity</option></select></label>
            <label className="os-auto-field">Size mode<select value={draft.sizeMode} onChange={(event) => set("sizeMode", event.target.value as RuleDraft["sizeMode"])}><option value="signal">As signaled</option><option value="fixed">Fixed units</option><option value="equity">% of equity</option><option value="risk">Scale to risk</option></select></label>
            {draft.sizeMode !== "signal" && <label className="os-auto-field">{draft.sizeMode === "fixed" ? "Units per order" : draft.sizeMode === "equity" ? "Equity allocation (%)" : "Risk per trade (%)"}<input type="number" min={0.001} step={draft.sizeMode === "fixed" ? 0.01 : 0.1} value={draft.sizeValue} onChange={(event) => set("sizeValue", Number(event.target.value))}/>{touched && <FieldError>{errors.size}</FieldError>}</label>}
            <label className="os-auto-field">SL / TP handling<select value={draft.stopMode} onChange={(event) => set("stopMode", event.target.value as RuleDraft["stopMode"])}><option value="signal">As signaled</option><option value="scaled">Scale distances</option><option value="defaults">Guardrail defaults</option><option value="none">Do not attach</option></select></label>
            {draft.stopMode === "scaled" && <label className="os-auto-field">Distance scale <span className="os-auto-input-suffix"><input type="number" min={1} max={300} value={draft.stopScalePct} onChange={(event) => set("stopScalePct", Number(event.target.value))}/><em>%</em></span></label>}
            <label className="os-auto-field">Execution style<select value={draft.execution} onChange={(event) => set("execution", event.target.value as RuleDraft["execution"])}><option value="market">Market on arrival</option><option value="limit">Limit at signal entry</option></select></label>
            {draft.execution === "limit" && <label className="os-auto-field">Entry tolerance <span className="os-auto-input-suffix"><input type="number" min={0} max={100} value={draft.slippagePips} onChange={(event) => set("slippagePips", Number(event.target.value))}/><em>pips</em></span></label>}
          </div>
          {primaryAccount && <div className="os-auto-mini-preview"><div><span className="os-auto-chip-label">SIM</span><b>{primaryAccount.label}</b><EnvPill env={primaryAccount.environment}/></div><span>{draft.sizeMode === "signal" ? "Uses each signal's parsed size" : draft.sizeMode === "fixed" ? `${draft.sizeValue} ${selectedSymbol?.volumeUnit ?? "units"} per order` : draft.sizeMode === "equity" ? `${draft.sizeValue}% of equity per order` : `${draft.sizeValue}% risk to the protective stop`}</span><span>{draft.stopMode === "none" ? "No attached stops" : draft.stopMode === "signal" ? "SL / TP from the signal" : draft.stopMode === "scaled" ? `Exits scaled ×${(draft.stopScalePct / 100).toFixed(2)}` : "Guardrail default exits"}</span></div>}
          {draft.accountIds.some((id) => accounts.find((account) => account.id === id)?.environment !== "paper") && <InlineNotice tone="warn">One or more broker accounts are selected. Their legs remain an execution preview until a backend is connected; no broker API calls are sent here.</InlineNotice>}
        </div>}

        {step === 4 && <div className="os-auto-step" aria-labelledby="auto-step-4">
          <div className="os-auto-step-head"><span>STEP 04</span><h3 id="auto-step-4">Set limits and review</h3><p>These limits stay inside the rule. The global kill switch always overrides everything.</p></div>
          <div className="os-auto-guard-grid">
            <label className="os-auto-field">Max trades / hour<input type="number" min={1} max={60} step={1} value={draft.maxTradesHour} onChange={(event) => set("maxTradesHour", Number(event.target.value))}/></label>
            <label className="os-auto-field">Max open positions contribution<input type="number" min={1} max={50} step={1} value={draft.maxOpenPositions} onChange={(event) => set("maxOpenPositions", Number(event.target.value))}/></label>
            <label className="os-auto-field">Daily-loss breaker <span className="os-auto-input-suffix"><input type="number" min={0.1} max={20} step={0.1} value={draft.dailyLossPct} onChange={(event) => set("dailyLossPct", Number(event.target.value))}/><em>%</em></span>{touched && <FieldError>{errors.dailyLoss}</FieldError>}</label>
            <label className="os-auto-field">Duplicate window <span className="os-auto-input-suffix"><input type="number" min={1} max={1440} step={1} value={draft.dedupeMinutes} onChange={(event) => set("dedupeMinutes", Number(event.target.value))}/><em>min</em></span></label>
          </div>
          <div className="os-auto-toggle-grid">
            <ToggleLine checked={draft.quietHours} onChange={(value) => set("quietHours", value)} label="Respect quiet hours" detail="Skip between 22:00 and 06:00 EAT."/>
            <ToggleLine checked={true} onChange={() => undefined} disabled label="Respect the kill switch" detail="Always on. This setting cannot be disabled."/>
          </div>
          <div className="os-auto-review">
            <div><span>Rule name</span><b>{draft.name || "Untitled rule"}</b></div>
            <div><span>Trigger</span><b>{draft.sources.map((source) => sourceOptions.find((option) => option.id === source)?.name).join(", ") || "None"}</b></div>
            <div><span>IF</span><b>{summarizeCondition(draft)}</b></div>
            <div><span>THEN</span><b>{summarizeAction(draft, accounts)}</b></div>
            <div><span>Latest 20 signals</span><b>{executeCount} would execute · {skipCount} would skip</b></div>
            <div><span>Last dry run</span><b>{draft.lastDryRunSummary ?? "Not run yet"}</b></div>
          </div>
          {issueCount > 0 && touched && <InlineNotice tone="danger">{issueCount} field{issueCount === 1 ? "" : "s"} still need attention before you can activate this rule.</InlineNotice>}
          {halted && <InlineNotice tone="danger">The global kill switch is engaged. You can save this draft, but activation will wait until the workspace is re-armed.</InlineNotice>}
          <div className="os-auto-builder-buttons">
            <button type="button" className="os-auto-secondary" disabled={saving} onClick={() => save(false)}><Save size={14}/> Save as draft</button>
            <button type="button" className="os-auto-secondary" disabled={dryRunning} onClick={finishDryRun}>{dryRunning ? <Loader2 size={14} className="os-spin"/> : <FlaskConical size={14}/>} {dryRunning ? "Simulating…" : "Run a dry run"}</button>
            <button type="button" className="os-auto-primary" disabled={saving || halted} onClick={() => save(true)}>{saving ? <Loader2 size={14} className="os-spin"/> : <Zap size={14}/>} Review &amp; activate</button>
          </div>
        </div>}
      </div>
    </div>

    <footer className="os-auto-builder-foot">
      <button type="button" className="os-auto-text-button" onClick={() => setStep((current) => (current > 1 ? (current - 1) as Step : current))} disabled={step === 1}><ArrowLeft size={14}/> Back</button>
      <div className="os-auto-builder-signal"><span className={`os-auto-listen ${draft.status === "active" ? "is-on" : ""}`} aria-hidden/><span>{draft.status === "active" ? "Active · evaluating locally" : "Draft · no orders will be sent"}</span></div>
      {step < 4 ? <button type="button" className="os-auto-primary" onClick={() => setStep((current) => (current + 1) as Step)}>Continue to {STEPS[Math.min(3, step)]?.title.toLowerCase()} <ArrowRight size={14}/></button> : <button type="button" className="os-auto-primary" onClick={() => save(true)}><Zap size={14}/> Activate</button>}
    </footer>
  </section>;
}
