import { useEffect, useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
export function applySavedTheme() {
  let pref: string | null = null;
  try { pref = localStorage.getItem("os-theme"); } catch { /* storage optional */ }
  document.documentElement.setAttribute("data-bs-theme", pref === "system" ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : pref === "dark" ? "dark" : "light");
}


function read(): Theme {
  return document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";
}
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });
  return () => obs.disconnect();
}

/** Light by default; choice persists in localStorage. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  useEffect(() => {
    applySavedTheme();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applySavedTheme);
    return () => media.removeEventListener("change", applySavedTheme);
  }, []);
  const setTheme = useCallback((t: ThemePreference) => {
    document.documentElement.setAttribute("data-bs-theme", t === "system" ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : t);
    try {
      localStorage.setItem("os-theme", t);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = useCallback(() => setTheme(read() === "dark" ? "light" : "dark"), [setTheme]);
  return { theme, setTheme, toggle };
}
