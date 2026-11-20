import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const push = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMsg({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="os-toast-wrap" aria-live="polite" role="status">
        {msg && (
          <div className="os-toast" key={msg.id}>
            <CheckCircle2 size={18} aria-hidden />
            <span>{msg.text}</span>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
