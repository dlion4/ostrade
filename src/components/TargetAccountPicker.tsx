import { BrokerBadge, EnvPill } from "./DashboardShell";
import type { TradingAccount } from "@/services/dashboard";

export function TargetAccountPicker({
  accounts,
  selected,
  onToggle,
}: {
  accounts: TradingAccount[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="os-target-picker row g-2 row-cols-1 row-cols-md-2 row-cols-xl-3 mb-3">
      {accounts.map((a) => (
        <div className="col" key={a.id}>
          <label
            className={`os-acc-tile ${selected.includes(a.id) ? "is-checked" : ""}`}
          >
            <input
              type="checkbox"
              aria-label={`Route to ${a.label}`}
              checked={selected.includes(a.id)}
              onChange={() => onToggle(a.id)}
            />
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <BrokerBadge broker={a.broker} label={a.brokerName} />
                <EnvPill env={a.environment} />
              </div>
              <strong className="d-block text-truncate mt-1">{a.label}</strong>
              <small className="text-secondary os-mono">
                {a.accountNumber} &middot; {a.leverage}
              </small>
            </div>
            <div className="text-end os-mono">
              <strong className="d-block">
                $
                {a.equity.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              <small className="text-secondary">
                Margin {a.marginUsedPct}%
              </small>
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}
