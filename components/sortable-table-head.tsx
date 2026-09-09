import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

export function SortableTableHead({
  label,
  href,
  active,
  direction,
  className,
}: {
  label: string;
  href: string;
  active: boolean;
  direction: "asc" | "desc";
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href={href} />}>
        {label}
        <Icon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}
