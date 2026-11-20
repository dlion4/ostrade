import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

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
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-bs-theme", t);
    try {
      localStorage.setItem("os-theme", t);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = useCallback(() => setTheme(read() === "dark" ? "light" : "dark"), [setTheme]);
  return { theme, setTheme, toggle };
}
