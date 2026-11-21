import { useEffect, useRef } from "react";

/** Six focused digits that auto-advance, accept a paste and step back with Backspace. */
export function OtpInputs({
  value,
  onChange,
  label,
  invalid,
  disabled,
  idPrefix = "otp",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    refs.current = refs.current.slice(0, 6);
  }, []);

  const setDigit = (i: number, d: string) => {
    const next = [...digits];
    next[i] = d;
    onChange(next.join("").slice(0, 6));
  };

  return (
    <div className={`os-otp ${invalid ? "is-invalid" : ""}`} role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          className="os-mono"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`${label} digit ${i + 1} of 6`}
          disabled={disabled}
          value={d}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              onChange(raw.slice(0, 6));
              refs.current[Math.min(5, raw.length - 1)]?.focus();
              return;
            }
            setDigit(i, raw);
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (digits[i]) setDigit(i, "");
              else if (i > 0) {
                e.preventDefault();
                setDigit(i - 1, "");
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const clipboard = e.clipboardData;
            if (!clipboard) return;
            const text = clipboard.getData("text").replace(/\D/g, "").slice(0, 6);
            if (text) {
              e.preventDefault();
              onChange(text);
              refs.current[Math.min(5, text.length - 1)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
