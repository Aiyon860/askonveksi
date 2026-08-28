import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/page-size-select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

function pageHref(pathname: string, page: number, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function DataPagination({
  pathname,
  page,
  pageCount,
  total,
  pageSize,
  params = {},
  pageSizeOptions,
  className,
}: {
  pathname: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  params?: Record<string, string | undefined>;
  pageSizeOptions?: readonly number[];
  className?: string;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageSizeParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== "pageSize"),
  );

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-xs text-muted-foreground">
        Menampilkan <strong className="font-medium text-foreground">{first}</strong> hingga <strong className="font-medium text-foreground">{last}</strong> dari <strong className="font-medium text-foreground">{total}</strong> data
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:justify-end">
        {pageSizeOptions ? (
          <PageSizeSelect pathname={pathname} value={pageSize} options={pageSizeOptions} params={pageSizeParams} />
        ) : null}
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          Halaman <strong className="font-medium text-foreground">{page}</strong> / <strong className="font-medium text-foreground">{pageCount}</strong>
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <PaginationLink href={pageHref(pathname, page - 1, params)} size="icon-sm" aria-label="Ke halaman sebelumnya">
                  <ChevronLeft aria-hidden="true" />
                </PaginationLink>
              ) : (
                <Button size="icon-sm" variant="ghost" disabled aria-label="Tidak ada halaman sebelumnya">
                  <ChevronLeft aria-hidden="true" />
                </Button>
              )}
            </PaginationItem>
            <PaginationItem>
              {page < pageCount ? (
                <PaginationLink href={pageHref(pathname, page + 1, params)} size="icon-sm" aria-label="Ke halaman berikutnya">
                  <ChevronRight aria-hidden="true" />
                </PaginationLink>
              ) : (
                <Button size="icon-sm" variant="ghost" disabled aria-label="Tidak ada halaman berikutnya">
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
