"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast, ToastType } from "@/types";

// ─── Toast Context ────────────────────────────────────────────
import { createContext, useContext } from "react";

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Individual Toast Item ─────────────────────────────────────
const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
  error: <XCircle size={18} className="text-rose-500 shrink-0" />,
  info: <Info size={18} className="text-blue-500 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
};

const barColors: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [toast.id, duration, onRemove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative flex items-start gap-3 bg-white rounded-2xl shadow-premium px-4 py-3.5 min-w-72 max-w-sm border border-slate-100 overflow-hidden",
        "transition-all duration-300",
        visible && !leaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      {/* Progress bar */}
      <span
        className={cn("absolute bottom-0 left-0 h-0.5 rounded-full", barColors[toast.type])}
        style={{ animation: `shrink-bar ${duration}ms linear forwards` }}
      />
      <style>{`@keyframes shrink-bar { from { width: 100% } to { width: 0% } }`}</style>

      {icons[toast.type]}
      <p className="flex-1 text-sm text-slate-700 leading-snug pt-0.5">{toast.message}</p>
      <button
        onClick={() => { setLeaving(true); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Toast Provider ────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const value: ToastContextValue = {
    toast: add,
    success: (m) => add(m, "success"),
    error: (m) => add(m, "error"),
    info: (m) => add(m, "info"),
    warning: (m) => add(m, "warning"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onRemove={remove} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
