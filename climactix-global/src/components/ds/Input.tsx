"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-ds-body text-[12px] font-medium text-ds-text2"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-ds-muted">{leftIcon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={cn(
              "h-9 w-full rounded-lg border bg-white font-ds-body text-[14px] text-ds-text",
              "border-ds-border px-3 placeholder:text-ds-muted",
              "transition-colors duration-150 ease-out",
              "focus:outline-none focus:ring-2 focus:ring-ds-accent focus:border-ds-accent",
              leftIcon && "pl-9",
              error && "border-ds-critical focus:ring-ds-critical",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="font-ds-body text-[12px] text-ds-critical">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="font-ds-body text-[12px] text-ds-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
