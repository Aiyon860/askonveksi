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
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}...</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {action ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </header>
  );
}

export function BackLinkSkeleton() {
  return <Skeleton className="h-8 w-40" />;
}

export function CardHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <CardHeader className={cn(action && "grid-cols-[1fr_auto]")}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      {action ? <Skeleton className="h-6 w-20" /> : null}
    </CardHeader>
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
}: {
  columns: number;
  rows?: number;
  className?: string;
}) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, column) => (
            <TableHead key={`head-${column}`}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={`row-${row}`} className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, column) => (
              <TableCell key={`cell-${row}-${column}`}>
                <Skeleton className={cn("h-4", column === 0 ? "w-32" : "w-20")} />
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
