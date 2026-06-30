"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn("flex items-center gap-1 border-b border-ds-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "relative px-3.5 py-2.5 font-ds-body text-[14px] font-medium text-ds-muted",
        "transition-colors duration-150 ease-out outline-none",
        "hover:text-ds-text",
        "data-[state=active]:text-ds-accent",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-transparent",
        "data-[state=active]:after:bg-ds-accent",
        "focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-1 rounded-t-md",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: RadixTabs.TabsContentProps) {
  return (
    <RadixTabs.Content
      className={cn("pt-4 outline-none animate-[fadeIn_180ms_ease-out]", className)}
      {...props}
    />
  );
}
