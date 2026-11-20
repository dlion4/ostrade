import { useMemo, useState } from "react";
import { z } from "zod";
import { Braces, Check, ChevronDown, Code2, Copy, ListChecks, Plus, Sparkles, Wand2, X } from "lucide-react";
import type { ConditionKind } from "@/data/automation";
import type { RuleDraft } from "@/services/automation";
import { useToast } from "@/components/Toast";

const schema = z.object({
  sources: z.array(z.enum(["telegram", "webhook", "copyfactory", "email", "paste", "csv"])).optional(),
  channels: z.array(z.string().min(1).max(80)).max(10).optional(),
  symbols: z.array(z.string().min(1).max(20)).max(30).optional(),
  side: z.enum(["ANY", "BUY", "SELL"]).optional(),
  requireSl: z.boolean().optional(),
  requireTp: z.boolean().optional(),
  session: z.enum(["any", "london", "newyork", "overlap", "asia", "sydney", "custom"]).optional(),
  sessionStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sessionEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  maxSpread: z.number().min(0).max(10000).optional(),
  marketOpenOnly: z.boolean().optional(),
  dedupeMinutes: z.number().int().min(1).max(1440).optional(),
  maxTradesHour: z.number().int().min(1).max(60).optional(),
  dailyLossPct: z.number().min(0.1).max(20).optional(),
}).strict();

const schemaExample = `{
  "symbols": ["XAUUSD", "EURUSD"],
  "side": "BUY",
  "requireSl": true,
  "minConfidence": 80,
  "maxSpread": 24,
  "session": "london"
}`;

export function ConditionLibraryPanel({
  conditions, draft, onPatch, onOpenBuilder,
}: {
  conditions: { id: string; group: string; title: string; description: string; example: string; apply: { kind: ConditionKind } }[];
  draft: RuleDraft;
  onPatch: (patch: Partial<RuleDraft>) => void;
  onOpenBuilder: () => void;
}) {
  const toast = useToast();
  const [group, setGroup] = useState("All");
  const [advanced, setAdvanced] = useState(false);
  const [json, setJson] = useState(schemaExample);
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const groups = useMemo(() => ["All", ...Array.from(new Set(conditions.map((condition) => condition.group)))], [conditions]);
  const visible = group === "All" ? conditions : conditions.filter((condition) => condition.group === group);
  const apply = (condition: (typeof conditions)[number]) => {
    switch (condition.apply.kind) {
      case "symbols": onPatch({ symbols: draft.symbols.length ? draft.symbols : ["XAUUSD"] }); break;
      case "side": onPatch({ side: draft.side === "ANY" ? "BUY" : "ANY" }); break;
      case "requireSl": onPatch({ requireSl: true }); break;
      case "requireTp": onPatch({ requireTp: true }); break;
      case "session": onPatch({ session: draft.session === "any" ? "london" : "any" }); break;
      case "confidence": onPatch({ minConfidence: Math.max(draft.minConfidence, 82) }); break;
      case "spread": onPatch({ maxSpread: draft.maxSpread || 18 }); break;
      case "marketOpen": onPatch({ marketOpenOnly: true }); break;
      case "channels": onPatch({ channels: draft.channels.length ? draft.channels : ["Gold Desk VIP"] }); break;
      case "dedupe": onPatch({ dedupeMinutes: draft.dedupeMinutes || 10 }); break;
      case "maxTradesHour": onPatch({ maxTradesHour: Math.max(1, draft.maxTradesHour) }); break;
      case "dailyLossPct": onPatch({ dailyLossPct: Math.min(20, Math.max(0.1, draft.dailyLossPct || 3)) }); break;
    }
    toast(`${condition.title} inserted into the draft rule`);
  };
  const validate = () => {
    try {
      const parsed = JSON.parse(json) as unknown;
      const result = schema.safeParse(parsed);
      if (!result.success) {
        setValidation({ ok: false, message: result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join(" • ") });
        return;
      }
      setValidation({ ok: true, message: `Valid · ${Object.keys(result.data).length} condition field${Object.keys(result.data).length === 1 ? "" : "s"} ready to apply.` });
    } catch (error) {
      setValidation({ ok: false, message: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON." });
    }
  };
  const applyJson = () => {
    try {
      const result = schema.safeParse(JSON.parse(json) as unknown);
      if (!result.success) { setValidation({ ok: false, message: "Fix the schema errors before applying." }); return; }
      onPatch(result.data as Partial<RuleDraft>);
      setValidation({ ok: true, message: "Condition JSON applied to the current draft." });
      toast("Advanced condition JSON applied");
    } catch { setValidation({ ok: false, message: "That is not valid JSON." }); }
  };
  const copyExample = async (example: string) => {
    try { await navigator.clipboard.writeText(example); toast("Condition example copied"); } catch { toast("Clipboard access is unavailable; select the example manually"); }
  };
  return <section className="os-auto-panel os-auto-library" aria-labelledby="auto-library-heading">
    <header className="os-auto-panel-head">
      <div><span className="os-auto-eyebrow">04 · CONDITION LIBRARY</span><h2 id="auto-library-heading">Build with proven conditions</h2><p>Every condition has a plain-language rule, a safe example, and a quick insert.</p></div>
      <button type="button" className={`os-auto-secondary${advanced ? " is-on" : ""}`} aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><Braces size={14}/> Advanced mode <ChevronDown size={12}/></button>
    </header>
    <div className="os-auto-condition-toolbar">
      <div className="os-auto-seg" role="group" aria-label="Filter condition library">{groups.map((item) => <button type="button" key={item} className={group === item ? "is-on" : ""} onClick={() => setGroup(item)}>{item}</button>)}</div>
      <button type="button" className="os-auto-text-button" onClick={onOpenBuilder}><Wand2 size={13}/> Return to builder</button>
    </div>
    {advanced && <div className="os-auto-advanced">
      <div className="os-auto-advanced-head"><div><span className="os-auto-overline">ADVANCED CONDITION JSON</span><h3>Edit the policy directly</h3></div><span className="os-auto-json-live"><Check size={12}/> Zod schema shown</span></div>
      <div className="os-auto-advanced-grid"><div className="os-auto-code-editor"><div><span><Code2 size={12}/> rule.conditions.json</span><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(json); toast("Condition JSON copied"); } catch { toast("Clipboard access is unavailable"); } }} aria-label="Copy JSON"><Copy size={12}/></button></div><textarea aria-label="Advanced condition JSON" spellCheck={false} value={json} onChange={(event) => { setJson(event.target.value); setValidation(null); }}/></div><div className="os-auto-schema"><span>Zod schema subset</span><pre>{`sources: SourceKey[]\nchannels: string[]\nsymbols: string[]\nside: 'ANY'|'BUY'|'SELL'\nrequireSl: boolean\nrequireTp: boolean\nsession: RuleSession\nminConfidence: 0…100\nmaxSpread: number ≥ 0\nmarketOpenOnly: boolean\ndedupeMinutes: 1…1440\nmaxTradesHour: 1…60\ndailyLossPct: 0.1…20`}</pre><small>Strict object. Unknown keys are rejected before the rule can be applied.</small></div></div>
      <div className="os-auto-advanced-actions"><button type="button" className="os-auto-secondary" onClick={validate}>Validate JSON</button><button type="button" className="os-auto-primary" disabled={!validation?.ok} onClick={applyJson}>Apply conditions</button>{validation && <span className={`os-auto-validation is-${validation.ok ? "ok" : "error"}`}>{validation.ok ? <Check size={12}/> : <X size={12}/>} {validation.message}</span>}</div>
    </div>}
    <div className="os-auto-condition-grid-list">{visible.map((condition) => <article key={condition.id} className="os-auto-condition-card"><div className="os-auto-condition-top"><span className="os-auto-condition-group"><Sparkles size={11}/>{condition.group}</span><button type="button" className="os-auto-insert" onClick={() => apply(condition)}><Plus size={12}/> Insert</button></div><h3>{condition.title}</h3><p>{condition.description}</p><div className="os-auto-example"><code>{condition.example}</code><button type="button" aria-label={`Copy example for ${condition.title}`} onClick={() => void copyExample(condition.example)}><Copy size={12}/></button></div></article>)}</div>
    <footer className="os-auto-panel-foot"><span><ListChecks size={13}/> {conditions.length} documented conditions · AND-composed</span><span className="os-auto-muted">Pre-trade checks are still enforced after these conditions pass.</span></footer>
  </section>;
}
