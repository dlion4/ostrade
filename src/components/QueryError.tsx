import { AlertTriangle, RotateCw } from "lucide-react";

export function QueryError({ title = "Could not load this section", onRetry }: { title?: string; onRetry: () => void }) {
  return (
    <div className="os-error" role="alert">
      <AlertTriangle size={22} className="mb-2" aria-hidden />
      <p className="fw-semibold mb-1">{title}</p>
      <p className="small text-secondary mb-3">Nothing was lost. Try again.</p>
      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={onRetry}>
        <RotateCw size={15} aria-hidden /> Retry
      </button>
    </div>
  );
}
