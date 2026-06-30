"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  width?: "sm" | "md" | "lg";
  side?: "left" | "right";
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

const WIDTH_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
};

export default function Drawer({
  open,
  onOpenChange,
  title,
  description,
  width = "md",
  side = "right",
  footer,
  children,
}: DrawerProps) {
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
        <div className={cn("fixed inset-0 z-50 flex", side === "right" ? "justify-end" : "justify-start")}>
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
            aria-labelledby="ds-drawer-title"
            tabIndex={-1}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "relative flex h-full w-full flex-col bg-white",
              side === "right" ? "border-l border-ds-border" : "border-r border-ds-border",
              WIDTH_CLASSES[width]
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds-border px-5 py-4">
              <div>
                <h2 id="ds-drawer-title" className="font-ds-heading text-[18px] font-bold text-ds-text">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 font-ds-body text-[13px] text-ds-muted">{description}</p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close panel"
                className="rounded-md p-1 text-ds-muted transition-colors duration-150 hover:bg-ds-surface hover:text-ds-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
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
