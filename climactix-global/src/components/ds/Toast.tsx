"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "warning" | "critical" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "text-ds-success",
  warning: "text-ds-warning",
  critical: "text-ds-critical",
  info: "text-ds-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { ...item, id }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
            <AnimatePresence>
              {items.map((item) => {
                const Icon = VARIANT_ICON[item.variant];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    role="status"
                    className="flex items-start gap-2.5 rounded-lg border border-ds-border bg-white p-3"
                  >
                    <Icon size={16} className={cn("mt-0.5 flex-shrink-0", VARIANT_CLASSES[item.variant])} />
                    <div className="flex-1">
                      <p className="font-ds-body text-[13px] font-medium text-ds-text">{item.title}</p>
                      {item.description && (
                        <p className="mt-0.5 font-ds-body text-[12px] text-ds-muted">{item.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(item.id)}
                      aria-label="Dismiss notification"
                      className="text-ds-muted hover:text-ds-text"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
