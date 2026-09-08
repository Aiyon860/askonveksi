import type { CSSProperties, ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function LoadingPage({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}...</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>
      {action ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </header>
  );
}

export function BackLinkSkeleton() {
  return <Skeleton className="h-9 w-32" />;
}

export function CardHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <CardHeader
      className={cn(
        action && "grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      {action ? <Skeleton className="h-6 w-20" /> : null}
    </CardHeader>
  );
}

export function SectionHeaderSkeleton({
  titleWidth = "w-44",
  descriptionWidth = "w-full max-w-2xl",
  action = false,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  action?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className={cn("h-5", titleWidth)} />
        {action ? <Skeleton className="h-8 w-24 shrink-0" /> : null}
      </div>
      <Skeleton className={cn("h-4", descriptionWidth)} />
    </div>
  );
}

export function FilterBarSkeleton({
  searchWidth = "w-full sm:max-w-md",
  actionWidth = "w-36",
  controls = 2,
}: {
  searchWidth?: string;
  actionWidth?: string;
  controls?: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 gap-2">
        <Skeleton className={cn("h-9", searchWidth)} />
        {Array.from({ length: controls }, (_, index) => (
          <Skeleton
            key={`filter-control-${index}`}
            className={index === controls - 1 ? "h-9 w-20 shrink-0" : "h-9 w-32 shrink-0"}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <Skeleton className="h-4 w-24" />
        <Skeleton className={cn("h-9", actionWidth)} />
      </div>
    </div>
  );
}

export function MetricStripSkeleton({
  items,
  className,
  itemClassName,
  layoutClassName,
  labelWidths,
  valueWidths,
  wideLast = false,
}: {
  items: number;
  className?: string;
  itemClassName?: string;
  layoutClassName?: string;
  labelWidths?: string[];
  valueWidths?: string[];
  wideLast?: boolean;
}) {
  return (
    <div
      className={cn("grid gap-px overflow-hidden rounded-lg border bg-border", layoutClassName, className)}
      aria-hidden="true"
    >
      {Array.from({ length: items }, (_, index) => (
        <div
          key={`metric-${index}`}
          className={cn(
            "flex min-h-26 flex-col gap-3 bg-card p-4",
            wideLast && index === items - 1 && "col-span-2 lg:col-span-1",
            itemClassName,
          )}
        >
          <Skeleton className={cn("h-4", labelWidths?.[index] ?? "w-20")} />
          <Skeleton className={cn("h-7", valueWidths?.[index] ?? "w-28 max-w-full")} />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton({
  columns,
  cardsPerColumn = 2,
  columnMinWidth = "17.5rem",
}: {
  columns: number;
  cardsPerColumn?: number | number[];
  columnMinWidth?: string;
}) {
  const counts = Array.isArray(cardsPerColumn)
    ? cardsPerColumn
    : Array.from({ length: columns }, () => cardsPerColumn);

  return (
    <div
      className="grid auto-cols-[var(--kanban-col-min,17.5rem)] grid-flow-col gap-3 overflow-x-hidden pb-3"
      style={{ "--kanban-col-min": columnMinWidth } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: columns }, (_, column) => (
        <section key={`kanban-column-${column}`} className="min-h-[24rem] rounded-lg border bg-muted/30 p-2">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-5" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: counts[column] ?? 1 }, (_, card) => (
              <Card key={`kanban-card-${column}-${card}`} size="sm">
                <CardHeader>
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function DetailLayoutSkeleton({
  mainRows = 3,
  asideCards = 2,
}: {
  mainRows?: number;
  asideCards?: number;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeaderSkeleton />
          <CardContent className="gap-5">
            {Array.from({ length: mainRows }, (_, row) => (
              <div key={`detail-main-${row}`} className="flex flex-col gap-3 border-b pb-5 last:border-b-0 last:pb-0">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-4 w-full max-w-2xl" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-6">
        {Array.from({ length: asideCards }, (_, card) => (
          <Card key={`detail-aside-${card}`} size="sm">
            <CardHeaderSkeleton action={card === 0} />
            <CardContent className="gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </aside>
    </div>
  );
}

export function FormSkeleton({
  fields = 4,
  columns = 1,
}: {
  fields?: number;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
      )}
    >
      {Array.from({ length: fields }, (_, index) => (
        <div key={`field-${index}`} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  columns,
  rows = 6,
  className,
  columnWidths,
  dense = false,
}: {
  columns: number;
  rows?: number;
  className?: string;
  columnWidths?: string[];
  dense?: boolean;
}) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, column) => (
            <TableHead key={`head-${column}`} className={dense ? "h-9" : undefined}>
              <Skeleton className={cn("h-4", columnWidths?.[column] ?? (column === 0 ? "w-28" : "w-20"))} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={`row-${row}`} className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, column) => (
              <TableCell key={`cell-${row}-${column}`} className={dense ? "py-2" : undefined}>
                <Skeleton className={cn("h-4", columnWidths?.[column] ?? (column === 0 ? "w-32" : "w-20"))} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FormCardSkeleton({
  fields = 4,
  columns = 1,
}: {
  fields?: number;
  columns?: 1 | 2 | 3;
}) {
  return (
    <Card>
      <CardHeaderSkeleton />
      <CardContent className="gap-5">
        <FormSkeleton fields={fields} columns={columns} />
        <Skeleton className="h-9 w-36" />
      </CardContent>
    </Card>
  );
}
