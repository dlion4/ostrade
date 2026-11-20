import {
  adapterDefaults,
  appearanceDefaults,
  localeDefaults,
  retentionDefaults,
  type BrokerVisibility,
} from "@/data/settings";
import type { BrokerKey } from "@/data/dashboard";
const key = "os-workspace-preferences-v1";
const defaults = {
  appearance: appearanceDefaults,
  locale: localeDefaults,
  brokers: adapterDefaults,
  visible: {} as BrokerVisibility,
  retention: retentionDefaults,
};
export type WorkspacePreferences = typeof defaults;
let state: WorkspacePreferences = structuredClone(defaults);
try {
  const saved = JSON.parse(
    localStorage.getItem(key) ?? "null",
  ) as Partial<WorkspacePreferences> | null;
  if (saved)
    state = {
      appearance: { ...defaults.appearance, ...saved.appearance },
      locale: { ...defaults.locale, ...saved.locale },
      brokers: { ...defaults.brokers, ...saved.brokers },
      visible: { ...saved.visible },
      retention: { ...defaults.retention, ...saved.retention },
    };
} catch {
  /* optional browser storage */
}
export const readPreferences = () => structuredClone(state);
export function writePreference<K extends keyof WorkspacePreferences>(
  keyName: K,
  value: WorkspacePreferences[K],
) {
  state = { ...state, [keyName]: structuredClone(value) };
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* retained for this visit */
  }
  return readPreferences();
}
export const brokerVisible = (broker: BrokerKey) =>
  broker === "paper" || state.visible[broker] !== false;
