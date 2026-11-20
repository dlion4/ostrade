import { createStart } from "@tanstack/react-start";

// Prerender the document only; trading services always run in the browser.
export const startInstance = createStart(() => ({ defaultSsr: false }));
