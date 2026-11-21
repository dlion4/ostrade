import { Outlet, createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

/** Pathless marketing layout: home + legal pages keep the public nav and footer. */
export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <>
      <a
        href="#main"
        className="visually-hidden-focusable os-skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <MarketingNav />
      <div id="main" tabIndex={-1} style={{ outline: "none" }}>
        <Outlet />
      </div>
      <MarketingFooter />
    </>
  );
}
