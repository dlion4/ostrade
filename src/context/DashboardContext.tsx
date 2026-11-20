import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { KillSwitchMode } from "@/services/dashboard";

export type GlobalWorkspaceMode = "paper" | "live";

interface DashboardContextValue {
  activeAccountId: string; // "all" or specific accountId
  setActiveAccountId: (id: string) => void;
  globalMode: GlobalWorkspaceMode;
  setGlobalMode: (mode: GlobalWorkspaceMode) => void;
  killSwitch: KillSwitchMode;
  setKillSwitch: (mode: KillSwitchMode) => void;
}

const DashboardCtx = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeAccountId, setActiveAccountState] = useState<string>(() => {
    try {
      return localStorage.getItem("os-active-account") || "all";
    } catch {
      return "all";
    }
  });

  const [globalMode, setGlobalModeState] = useState<GlobalWorkspaceMode>(() => {
    try {
      return localStorage.getItem("os-global-mode") === "live" ? "live" : "paper";
    } catch {
      return "paper";
    }
  });

  const [killSwitch, setKillSwitch] = useState<KillSwitchMode>("armed");

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountState(id);
    try {
      localStorage.setItem("os-active-account", id);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const setGlobalMode = useCallback((mode: GlobalWorkspaceMode) => {
    setGlobalModeState(mode);
    try {
      localStorage.setItem("os-global-mode", mode);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  return (
    <DashboardCtx.Provider
      value={{
        activeAccountId,
        setActiveAccountId,
        globalMode,
        setGlobalMode,
        killSwitch,
        setKillSwitch,
      }}
    >
      {children}
    </DashboardCtx.Provider>
  );
}

export function useDashboardContext() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) {
    throw new Error("useDashboardContext must be used inside DashboardProvider");
  }
  return ctx;
}
