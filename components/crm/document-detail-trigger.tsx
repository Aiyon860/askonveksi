"use client";

import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function DocumentDetailTrigger({
  children,
  className,
  onActivate,
  variant = "table-row",
}: {
  children: ReactNode;
  className?: string;
  onActivate: () => void;
  variant?: "preview" | "table-row";
}) {
  if (variant === "preview") {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onActivate}
        className={cn(
          "flex min-h-20 w-full flex-col items-stretch justify-between gap-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center",
          className,
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <TableRow
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {children}
    </TableRow>
  );
}
