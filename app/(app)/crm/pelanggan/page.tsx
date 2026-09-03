import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ListFilter,
  RotateCcw,
  UserRoundX,
  UsersRound,
} from "lucide-react";

import { archiveCustomerAction, restoreCustomerAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EditCustomerForm } from "@/components/crm/edit-customer-form";
import { NewCustomerForm } from "@/components/crm/new-customer-form";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { DataPagination } from "@/components/data-pagination";
import { TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { CustomerActivityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ARCHIVE_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import {
  getCustomers,
  type CustomerSegment,
  type CustomerSort,
  type SortDirection,
} from "@/lib/crm/data";
import { getCustomerFormOptions } from "@/lib/master-data";
import { formatDate } from "@/lib/crm/format";
import { activityStatusFromSchedule } from "@/lib/crm/reminder-types";
import {
  DATA_PAGE_SIZE,
  DATA_PAGE_SIZES,
  parsePageParam,
  parsePageSizeParam,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

const CUSTOMER_SORTS = ["customerNo", "name", "opportunities", "updatedAt"] as const satisfies readonly CustomerSort[];
const SORT_DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type CustomerSearchParams = Promise<{
  q?: string | string[];
  archived?: string | string[];
  segment?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  sort?: string | string[];
  order?: string | string[];
}>;

type TableState = {
  query: string;
  segment: CustomerSegment;
  page: number;
  pageSize: number;
  sort: CustomerSort;
  direction: SortDirection;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultDirection(sort: CustomerSort): SortDirection {
  return sort === "updatedAt" ? "desc" : "asc";
}

function parseSort(value: string | string[] | undefined): CustomerSort {
  const raw = firstParam(value);
  return CUSTOMER_SORTS.find((item) => item === raw) ?? "updatedAt";
}

function parseDirection(value: string | string[] | undefined, sort: CustomerSort): SortDirection {
  const raw = firstParam(value);
  return SORT_DIRECTIONS.find((item) => item === raw) ?? defaultDirection(sort);
}

function tableHref(state: TableState, changes: Partial<TableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.segment !== "all") params.set("segment", next.segment);
  if (next.sort !== "updatedAt") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/crm/pelanggan?${query}` : "/crm/pelanggan";
}

function SortableHead({
  label,
  value,
  state,
  className,
}: {
  label: string;
  value: CustomerSort;
  state: TableState;
  className?: string;
}) {
  const isCurrent = state.sort === value;
  const nextDirection = isCurrent
    ? state.direction === "asc" ? "desc" : "asc"
    : defaultDirection(value);
  const Icon = !isCurrent ? ArrowUpDown : state.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={isCurrent ? (state.direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        nativeButton={false}
        render={<Link href={tableHref(state, { sort: value, direction: nextDirection, page: 1 })} />}
      >
        {label}
        <Icon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}

function CustomersTableFallback() {
  return (
    <section
      className="overflow-hidden rounded-xl border bg-background"
      role="status"
      aria-live="polite"
      aria-label="Memuat tabel customer"
    >
      <span className="sr-only">Memuat tabel customer...</span>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" aria-hidden="true">
        <div className="flex min-w-0 flex-1 gap-2">
          <Skeleton className="h-9 w-full sm:max-w-md" />
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="min-h-112" aria-hidden="true">
        <TableSkeleton columns={12} rows={8} className="min-w-6xl" />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3" aria-hidden="true">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-52" />
      </div>
    </section>
  );
}

async function CustomersTableSection({ searchParams }: { searchParams: CustomerSearchParams }) {
  const params = await searchParams;
  const rawQuery = firstParam(params.q) ?? "";
  const query = rawQuery.trim().slice(0, 80);
  const rawSegment = firstParam(params.segment);
  const segment: CustomerSegment = rawSegment === "repeat" || rawSegment === "inactive" || rawSegment === "archived"
    ? rawSegment
    : firstParam(params.archived) === "true"
      ? "archived"
      : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = parseSort(params.sort);
  const direction = parseDirection(params.order, sort);
  const state = { query, segment, page, pageSize, sort, direction } satisfies TableState;
  const [{ items: customers, total, pageCount }, actor, formOptions] = await Promise.all([
    getCustomers(state),
    getCurrentActor(),
    getCustomerFormOptions(),
  ]);
  const canChangeArchiveStatus = Boolean(actor && hasRole(actor.role, ARCHIVE_ROLES));
  const canOperate = actor?.role === "ADMIN" || actor?.role === "SALES";
  const archived = segment === "archived";
  const showActions = Boolean(canOperate && (!archived || canChangeArchiveStatus));

  if (page > pageCount) {
    redirect(tableHref(state, { page: pageCount }));
  }

  const persistentParams = {
    q: query || undefined,
    segment: segment !== "all" ? segment : undefined,
    sort: sort !== "updatedAt" ? sort : undefined,
    order: direction !== defaultDirection(sort) ? direction : undefined,
    pageSize: pageSize !== DATA_PAGE_SIZE ? String(pageSize) : undefined,
  };

  return (
    <section
        className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
        aria-label={segment === "repeat" ? "Customer berpotensi repeat order" : segment === "inactive" ? "Customer tidak aktif" : archived ? "Customer terarsip" : "Semua customer aktif"}
      >
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <DebouncedSearchInput
              key={query}
              initialValue={query}
              pathname="/crm/pelanggan"
              params={persistentParams}
              placeholder="Cari nama, nomor, atau kontak..."
              ariaLabel="Cari customer"
              className="sm:max-w-md"
            />

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <ListFilter data-icon="inline-start" aria-hidden="true" />
                {segment === "repeat" ? "Potensi repeat" : segment === "inactive" ? "Tidak aktif" : archived ? "Arsip" : "Semua customer"}
                <ChevronDown data-icon="inline-end" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status customer</DropdownMenuLabel>
                  <DropdownMenuItem render={<Link href={tableHref(state, { segment: "all", page: 1 })} />}>
                    <Check className={cn(segment !== "all" && "opacity-0")} aria-hidden="true" />
                    Semua customer
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={tableHref(state, { segment: "repeat", page: 1 })} />}>
                    <RotateCcw className={cn(segment !== "repeat" && "opacity-50")} aria-hidden="true" />
                    Potensi repeat order
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={tableHref(state, { segment: "inactive", page: 1 })} />}>
                    <UserRoundX className={cn(segment !== "inactive" && "opacity-50")} aria-hidden="true" />
                    Customer tidak aktif
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={tableHref(state, { segment: "archived", page: 1 })} />}>
                    <Check className={cn(segment !== "archived" && "opacity-0")} aria-hidden="true" />
                    Customer arsip
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">{total}</strong> {segment === "repeat" ? "potensi repeat" : segment === "inactive" ? "customer tidak aktif" : archived ? "customer diarsipkan" : "customer aktif"}
            </p>
            {canOperate ? <NewCustomerForm key={`new-${segment}-${query}-${total}`} {...formOptions} /> : null}
          </div>
        </div>

        {customers.length ? (
          <div className="flex min-h-112 flex-1 flex-col">
            <Table
              className={showActions ? "min-w-5xl" : "min-w-232"}
              containerClassName="min-h-0 flex-1 overflow-auto"
            >
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow className="hover:bg-muted">
                  <TableHead className="w-16 text-center">No</TableHead>
                  <SortableHead label="No. customer" value="customerNo" state={state} />
                  <SortableHead label="Customer" value="name" state={state} className="min-w-56" />
                  <TableHead className="min-w-48">Jenis</TableHead>
                  <TableHead className="min-w-48">Perusahaan/komunitas</TableHead>
                  <TableHead className="min-w-48">Sales/PIC</TableHead>
                  <TableHead className="min-w-40">Status aktivitas</TableHead>
                  <TableHead className="min-w-36">Order terakhir</TableHead>
                  <TableHead className="min-w-56">Kontak</TableHead>
                  <SortableHead label="Peluang" value="opportunities" state={state} />
                  <SortableHead label="Diperbarui" value="updatedAt" state={state} />
                  {showActions ? <TableHead className="w-56">Aksi</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer, index) => {
                  const contacts = [
                    customer.whatsapp,
                    customer.email,
                    customer.instagram ? `@${customer.instagram}` : null,
                  ].filter((contact): contact is string => Boolean(contact));
                  const activityStatus = activityStatusFromSchedule(
                    customer.reminders,
                    new Date(),
                    customer.hasOpenOpportunity,
                  );
                  const latestOrder = customer.reminders[0]?.sourceSalesOrder;

                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="text-center font-mono text-muted-foreground tabular-nums">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{customer.customerNo}</TableCell>
                      <TableCell>
                        <Link
                          href={`/crm/pelanggan/${customer.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p>{customer.customerType.name}</p>
                        {customer.leadSource ? <p className="mt-1 text-xs text-muted-foreground">{customer.leadSource.name}</p> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <p>{customer.companyName ?? "-"}</p>
                        {customer.city ? <p className="mt-1 text-xs">{customer.city}</p> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.salesPic?.name ?? "Belum ditugaskan"}</TableCell>
                      <TableCell>
                        <CustomerActivityBadge status={activityStatus} archived={Boolean(customer.archivedAt)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {latestOrder ? formatDate(latestOrder.acceptedAt) : "Belum ada"}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p className="text-sm">{contacts[0] ?? "-"}</p>
                        {contacts[1] ? <p className="mt-1 text-xs text-muted-foreground">{contacts[1]}</p> : null}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{customer._count.opportunities}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(customer.opportunities[0]?.updatedAt ?? customer.updatedAt)}
                      </TableCell>
                      {showActions ? (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!archived && canOperate ? (
                              <EditCustomerForm
                                key={`edit-${customer.id}-${customer.version}`}
                                customer={customer}
                                {...formOptions}
                              />
                            ) : null}
                            {canChangeArchiveStatus ? (
                              <form action={archived ? restoreCustomerAction : archiveCustomerAction}>
                                <input type="hidden" name="customerId" value={customer.id} />
                                <input type="hidden" name="version" value={customer.version} />
                                <ConfirmSubmitButton
                                  variant={archived ? "outline" : "destructive"}
                                  size="sm"
                                  pendingLabel="Memproses..."
                                  confirmTitle={archived ? "Aktifkan kembali customer?" : "Arsipkan customer?"}
                                  confirmDescription={archived
                                    ? "Customer akan tersedia kembali untuk peluang dan transaksi baru."
                                    : "Customer tidak lagi tersedia untuk peluang baru. Riwayat transaksi tetap tersimpan."}
                                  confirmLabel={archived ? "Ya, aktifkan" : "Ya, arsipkan"}
                                >
                                  {archived ? (
                                    <ArchiveRestore data-icon="inline-start" aria-hidden="true" />
                                  ) : (
                                    <Archive data-icon="inline-start" aria-hidden="true" />
                                  )}
                                  {archived ? "Aktifkan" : "Arsipkan"}
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <DataPagination
              pathname="/crm/pelanggan"
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={DATA_PAGE_SIZES}
              params={persistentParams}
              className="border-t px-4 py-3"
            />
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><UsersRound aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{query ? "Customer tidak ditemukan" : archived ? "Arsip masih kosong" : segment === "repeat" ? "Belum ada potensi repeat order" : segment === "inactive" ? "Belum ada customer tidak aktif" : "Belum ada customer"}</EmptyTitle>
              <EmptyDescription>{query ? "Coba kata kunci lain atau hapus filter pencarian." : segment === "repeat" ? "Customer tanpa peluang terbuka akan muncul 3 bulan setelah order terakhir." : segment === "inactive" ? "Customer tanpa peluang terbuka akan muncul 6 bulan setelah order terakhir." : "Tambahkan customer atau buat lead baru dari pipeline."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
    </section>
  );
}

export default function CustomersPage({ searchParams }: { searchParams: CustomerSearchParams }) {
  return (
    <>
      <PageHeader
        title="Data customer"
        description="Cari, urutkan, dan kelola satu profil customer untuk seluruh peluang dan repeat order."
      />
      <PageMessage />

      <Suspense fallback={<CustomersTableFallback />}>
        <CustomersTableSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}
