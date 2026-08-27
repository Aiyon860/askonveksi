import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

function pageHref(pathname: string, page: number, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function visiblePages(page: number, pageCount: number) {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  return pages.flatMap<(number | "ellipsis")>((value, index) => {
    const previous = pages[index - 1];
    return previous && value - previous > 1 ? ["ellipsis", value] : [value];
  });
}

export function DataPagination({
  pathname,
  page,
  pageCount,
  total,
  pageSize,
  params = {},
  className,
}: {
  pathname: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  params?: Record<string, string | undefined>;
  className?: string;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="text-xs text-muted-foreground">Menampilkan {first}–{last} dari {total} data</p>
      {pageCount > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            {page > 1 ? (
              <PaginationItem>
                <PaginationPrevious href={pageHref(pathname, page - 1, params)} text="Sebelumnya" />
              </PaginationItem>
            ) : null}
            {visiblePages(page, pageCount).map((item, index) => item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink href={pageHref(pathname, item, params)} isActive={item === page}>{item}</PaginationLink>
              </PaginationItem>
            ))}
            {page < pageCount ? (
              <PaginationItem>
                <PaginationNext href={pageHref(pathname, page + 1, params)} text="Berikutnya" />
              </PaginationItem>
            ) : null}
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
