"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function CustomerTableRowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function openDetail() {
    router.push(href);
  }

  function prefetchDetail() {
    router.prefetch(href);
  }

  return (
    <TableRow
      tabIndex={0}
      role="link"
      onClick={openDetail}
      onFocus={prefetchDetail}
      onMouseEnter={prefetchDetail}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
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
