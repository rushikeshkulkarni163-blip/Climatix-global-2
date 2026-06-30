"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  className,
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="font-ds-body text-[12px] font-medium text-ds-text2">{label}</span>}
      <RadixSelect.Root value={value} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-lg border border-ds-border bg-white px-3",
            "font-ds-body text-[14px] text-ds-text transition-colors duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-ds-accent data-[placeholder]:text-ds-muted",
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown size={14} className="text-ds-muted" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-lg border border-ds-border bg-white shadow-none"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-7 pr-3",
                    "font-ds-body text-[14px] text-ds-text outline-none",
                    "data-[highlighted]:bg-ds-accent-bg data-[highlighted]:text-ds-accent"
                  )}
                >
                  <RadixSelect.ItemIndicator className="absolute left-2 inline-flex items-center">
                    <Check size={14} />
                  </RadixSelect.ItemIndicator>
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
