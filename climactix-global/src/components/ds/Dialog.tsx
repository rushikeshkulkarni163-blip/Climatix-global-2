"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-ds-text/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ds-dialog-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "relative w-full rounded-lg border border-ds-border bg-white",
              "max-h-[85vh] overflow-y-auto",
              SIZE_CLASSES[size]
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds-border px-5 py-4">
              <div>
                <h2 id="ds-dialog-title" className="font-ds-heading text-[18px] font-bold text-ds-text">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 font-ds-body text-[13px] text-ds-muted">{description}</p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close dialog"
                className="rounded-md p-1 text-ds-muted transition-colors duration-150 hover:bg-ds-surface hover:text-ds-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-ds-border px-5 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
