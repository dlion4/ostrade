import { useLayoutEffect } from "react";

/**
 * Page-scoped stylesheet lifecycle: mounts a <style data-os-page> on route enter
 * and removes it on route leave, so page CSS can never leak across routes.
 */
export function usePageStyle(id: string, css: string) {
  useLayoutEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-os-page", id);
    el.textContent = css;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [id, css]);
}
