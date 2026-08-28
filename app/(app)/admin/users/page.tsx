import type { AppRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ListFilter,
  UserPlus,
  UsersRound,
} from "lucide-react";

import { createUserAction } from "@/app/actions/users";
import { UsersTableBody } from "@/components/admin/users-table-body";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { TableSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentActor } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/crm/constants";
import {
  getUsers,
  type SortDirection,
  type UserSort,
  type UserStatusFilter,
} from "@/lib/crm/data";
import {
  DATA_PAGE_SIZE,
  DATA_PAGE_SIZES,
  parsePageParam,
  parsePageSizeParam,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

const USER_ROLES = ["OWNER", "ADMIN", "SALES"] as const satisfies readonly AppRole[];
const USER_STATUSES = ["all", "active", "inactive"] as const satisfies readonly UserStatusFilter[];
const USER_SORTS = ["createdAt", "email", "isActive", "name", "role"] as const satisfies readonly UserSort[];
const SORT_DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

type UserSearchParams = Promise<{
  q?: string | string[];
  role?: string | string[];
  status?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  sort?: string | string[];
  order?: string | string[];
}>;

type UserTableState = {
  query: string;
  role: AppRole | "all";
  status: UserStatusFilter;
  page: number;
  pageSize: number;
  sort: UserSort;
  direction: SortDirection;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultDirection(sort: UserSort): SortDirection {
  return sort === "createdAt" ? "desc" : "asc";
}

function parseRole(value: string | string[] | undefined): AppRole | "all" {
  const raw = firstParam(value);
  return USER_ROLES.find((item) => item === raw) ?? "all";
}

function parseStatus(value: string | string[] | undefined): UserStatusFilter {
  const raw = firstParam(value);
  return USER_STATUSES.find((item) => item === raw) ?? "all";
}

function parseSort(value: string | string[] | undefined): UserSort {
  const raw = firstParam(value);
  return USER_SORTS.find((item) => item === raw) ?? "createdAt";
}

function parseDirection(value: string | string[] | undefined, sort: UserSort): SortDirection {
  const raw = firstParam(value);
  return SORT_DIRECTIONS.find((item) => item === raw) ?? defaultDirection(sort);
}

function usersHref(state: UserTableState, changes: Partial<UserTableState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.role !== "all") params.set("role", next.role);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "createdAt") params.set("sort", next.sort);
  if (next.direction !== defaultDirection(next.sort)) params.set("order", next.direction);
  if (next.pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

function SortableHead({
  label,
  value,
  state,
  className,
}: {
  label: string;
  value: UserSort;
  state: UserTableState;
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
        render={<Link href={usersHref(state, { sort: value, direction: nextDirection, page: 1 })} />}
      >
        {label}
        <Icon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}

function UsersTableFallback() {
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
      role="status"
      aria-live="polite"
      aria-label="Memuat daftar pengguna"
    >
      <span className="sr-only">Memuat daftar pengguna...</span>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" aria-hidden="true">
        <div className="flex min-w-0 flex-1 gap-2">
          <Skeleton className="h-9 w-full sm:max-w-md" />
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="min-h-112" aria-hidden="true">
        <TableSkeleton columns={6} rows={8} className="min-w-5xl" />
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
    </section>
  );
}

async function UsersTableSection({ searchParams }: { searchParams: UserSearchParams }) {
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim().slice(0, 120);
  const role = parseRole(params.role);
  const status = parseStatus(params.status);
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const sort = parseSort(params.sort);
  const direction = parseDirection(params.order, sort);
  const state = { query, role, status, page, pageSize, sort, direction } satisfies UserTableState;
  const [{ items: users, total, activeTotal, allTotal, pageCount }, actor] = await Promise.all([
    getUsers(state),
    getCurrentActor(),
  ]);

  if (page > pageCount) redirect(usersHref(state, { page: pageCount }));

  const persistentParams = {
    q: query || undefined,
    role: role !== "all" ? role : undefined,
    status: status !== "all" ? status : undefined,
    sort: sort !== "createdAt" ? sort : undefined,
    order: direction !== defaultDirection(sort) ? direction : undefined,
    pageSize: pageSize !== DATA_PAGE_SIZE ? String(pageSize) : undefined,
  };
  const activeFilterCount = Number(role !== "all") + Number(status !== "all");

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background" aria-label="Daftar pengguna">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <DebouncedSearchInput
                key={query}
                initialValue={query}
                pathname="/admin/users"
                params={persistentParams}
                placeholder="Cari nama atau email..."
                ariaLabel="Cari pengguna"
                className="sm:max-w-md"
                maxLength={120}
              />

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <ListFilter data-icon="inline-start" aria-hidden="true" />
                  {activeFilterCount ? `Filter · ${activeFilterCount}` : "Filter"}
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Status akun</DropdownMenuLabel>
                    {USER_STATUSES.map((item) => (
                      <DropdownMenuItem
                        key={item}
                        render={<Link href={usersHref(state, { status: item, page: 1 })} />}
                      >
                        <Check className={cn(status !== item && "opacity-0")} aria-hidden="true" />
                        {item === "all" ? "Semua status" : item === "active" ? "Aktif" : "Nonaktif"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Role</DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={usersHref(state, { role: "all", page: 1 })} />}>
                      <Check className={cn(role !== "all" && "opacity-0")} aria-hidden="true" />
                      Semua role
                    </DropdownMenuItem>
                    {USER_ROLES.map((item) => (
                      <DropdownMenuItem
                        key={item}
                        render={<Link href={usersHref(state, { role: item, page: 1 })} />}
                      >
                        <Check className={cn(role !== item && "opacity-0")} aria-hidden="true" />
                        {ROLE_LABEL[item]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="shrink-0 text-xs text-muted-foreground">
              {activeFilterCount || query ? (
                <><strong className="font-medium text-foreground">{total}</strong> pengguna ditemukan</>
              ) : (
                <><strong className="font-medium text-foreground">{activeTotal}</strong> aktif dari <strong className="font-medium text-foreground">{allTotal}</strong> akun</>
              )}
            </p>
          </div>

          {users.length ? (
            <div className="flex min-h-112 flex-1 flex-col">
              <Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto">
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="hover:bg-muted">
                    <TableHead className="w-16 text-center">No</TableHead>
                    <SortableHead label="Pengguna" value="name" state={state} className="min-w-48" />
                    <SortableHead label="Email" value="email" state={state} className="min-w-56" />
                    <SortableHead label="Role" value="role" state={state} />
                    <SortableHead label="Status" value="isActive" state={state} />
                    <TableHead className="min-w-52">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <UsersTableBody
                  users={users.map((user) => ({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                    mustChangePassword: user.mustChangePassword,
                    updatedAt: user.updatedAt.toISOString(),
                  }))}
                  actorId={actor?.id}
                  numberOffset={(page - 1) * pageSize}
                  returnTo={usersHref(state, {})}
                />
              </Table>
              <DataPagination
                pathname="/admin/users"
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
                <EmptyTitle>Pengguna tidak ditemukan</EmptyTitle>
                <EmptyDescription>Coba kata kunci lain atau ubah filter status dan role.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
    </section>
  );
}

function NewUserCard() {
  return (
    <Card>
          <CardHeader>
            <CardTitle>Tambah pengguna</CardTitle>
            <CardDescription>Akun langsung aktif dan tidak mengirim undangan email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUserAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name" required>Nama</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    pattern="(?=(?:.*\S){2,}).*"
                    title="Nama minimal 2 karakter selain spasi."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email" required>Email</FieldLabel>
                  <Input id="email" name="email" type="email" required maxLength={320} autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role" required>Role</FieldLabel>
                  <NativeSelect id="role" name="role" required defaultValue="SALES" className="w-full">
                    <NativeSelectOption value="OWNER">Owner</NativeSelectOption>
                    <NativeSelectOption value="ADMIN">Admin</NativeSelectOption>
                    <NativeSelectOption value="SALES">Sales</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="temporaryPassword" required>Password sementara</FieldLabel>
                  <PasswordInput
                    id="temporaryPassword"
                    name="temporaryPassword"
                    required
                    minLength={12}
                    maxLength={128}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*"
                    title="Gunakan minimal 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol."
                    autoComplete="new-password"
                  />
                  <FieldDescription>Minimal 12 karakter dengan huruf besar, kecil, angka, dan simbol.</FieldDescription>
                </Field>
                <ConfirmSubmitButton
                  pendingLabel="Membuat akun..."
                  confirmTitle="Buat pengguna baru?"
                  confirmDescription="Akun akan langsung aktif dan memperoleh akses sesuai role yang dipilih."
                  confirmLabel="Ya, buat pengguna"
                >
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                  Buat pengguna
                </ConfirmSubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
    </Card>
  );
}

export default function UsersPage({ searchParams }: { searchParams: UserSearchParams }) {
  return (
    <>
      <PageHeader
        title="Pengguna aplikasi"
        description="Owner membuat akun langsung dengan password sementara. Role tidak disimpan pada metadata Auth."
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Suspense fallback={<UsersTableFallback />}>
          <UsersTableSection searchParams={searchParams} />
        </Suspense>
        <NewUserCard />
      </div>
    </>
  );
}
