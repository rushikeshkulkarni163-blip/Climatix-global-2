"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-ds-accent text-white border border-ds-accent hover:bg-ds-accent-hi focus-visible:ring-ds-accent",
  secondary:
    "bg-white text-ds-text border border-ds-border hover:border-ds-accent hover:text-ds-accent focus-visible:ring-ds-accent",
  ghost:
    "bg-transparent text-ds-text2 border border-transparent hover:bg-ds-surface hover:text-ds-text focus-visible:ring-ds-accent",
  danger:
    "bg-white text-ds-critical border border-ds-critical hover:bg-ds-critical-bg focus-visible:ring-ds-critical",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[14px] gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-ds-body font-medium",
          "transition-colors duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
