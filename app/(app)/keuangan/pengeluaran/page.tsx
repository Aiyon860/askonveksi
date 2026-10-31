import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ReceiptText, Trash2 } from "lucide-react";

import { deleteExpenseAction, reimburseExpenseAction } from "@/app/actions/finance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ExpenseForm } from "@/components/finance/expense-form";
import { ExportButton } from "@/components/export/export-button";
import { PaymentProofPreview } from "@/components/payment-proof-preview";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableViewport } from "@/components/table-viewport";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { numericCellClass } from "@/lib/table-alignment";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_TYPE_LABEL, type ExpenseTypeFilter } from "@/lib/finance/expense-categories";
import { getExpenses } from "@/lib/finance/expense";
import { getActivePaymentMethods } from "@/lib/master-data";
import { parseFinanceDateRange } from "@/lib/finance/date-range";
import { hasRole, OWNER_ACTION_ROLES } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; category?: string | string[]; expenseType?: string | string[]; method?: string | string[]; order?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function dateSortHref(params: Record<string, string | undefined>, order: "asc" | "desc") {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
  if (order === "desc") search.set("order", "asc");
  const query = search.toString();
  return query ? `/keuangan/pengeluaran?${query}` : "/keuangan/pengeluaran";
}

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const candidateRange = rawFrom && rawTo ? parseFinanceDateRange(rawFrom, rawTo) : null;
  const range = candidateRange && candidateRange.from === rawFrom && candidateRange.to === rawTo ? candidateRange : null;
  const rawCategory = first(params.category);
  const category = EXPENSE_CATEGORIES.includes(rawCategory as never) ? rawCategory as (typeof EXPENSE_CATEGORIES)[number] : "all";
  const rawType = first(params.expenseType);
  const expenseType: ExpenseTypeFilter = rawType === "OPERASIONAL" || rawType === "PROJECT" ? rawType : "all";
  const rawMethod = first(params.method);
  const [methods, actor] = await Promise.all([getActivePaymentMethods(), getCurrentActor()]);
  const method = methods.some((item) => item.id === rawMethod) ? rawMethod as string : "all";
  const order = first(params.order) === "asc" ? "asc" : "desc";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const data = await getExpenses({ query, customer: "", from: range?.start ?? null, to: range?.end ?? null, category, expenseType, method, creatorId: "all", order, page, pageSize });
  const persistent = { q: query || undefined, from: range?.from, to: range?.to, category: category === "all" ? undefined : category, expenseType: expenseType === "all" ? undefined : expenseType, method: method === "all" ? undefined : method, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  // Filter export = filter tabel (termasuk sort); rentang 90 hari bawaan diterapkan di route data.
  const exportParams = { ...persistent, pageSize: undefined, order: order === "desc" ? undefined : order };

  return <>
    
    <PageHeader title="Pengeluaran" description="Catat dan lacak biaya operasional dan project yang digunakan." action={<div className="flex items-center gap-2"><Button variant="outline" render={<Link href="/keuangan/pengeluaran/riwayat" />} nativeButton={false}>Riwayat Hapus</Button><ExportButton workbookScope="pengeluaran" params={exportParams} /><ExpenseForm methods={methods} /></div>} />
    <PageMessage />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <DebouncedSearchInput key={query} initialValue={query} pathname="/keuangan/pengeluaran" params={persistent} placeholder="Cari keperluan / customer pengeluaran..." ariaLabel="Cari pengeluaran" className="lg:max-w-md" />
        <form action="/keuangan/pengeluaran" className="flex flex-wrap items-end gap-2 lg:justify-end">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {order !== "desc" ? <input type="hidden" name="order" value={order} /> : null}
          {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        <Field className="w-full sm:w-40"><FieldLabel htmlFor="expense-from">Dari tanggal</FieldLabel><Input id="expense-from" name="from" type="date" defaultValue={range?.from ?? ""} /></Field>
        <Field className="w-full sm:w-40"><FieldLabel htmlFor="expense-to">Sampai tanggal</FieldLabel><Input id="expense-to" name="to" type="date" defaultValue={range?.to ?? ""} /></Field>
        <Field className="w-full sm:w-36"><FieldLabel htmlFor="expense-type-filter">Tipe</FieldLabel><NativeSelect id="expense-type-filter" name="expenseType" defaultValue={expenseType} className="w-full"><NativeSelectOption value="all">{EXPENSE_TYPE_LABEL.all}</NativeSelectOption><NativeSelectOption value="OPERASIONAL">{EXPENSE_TYPE_LABEL.OPERASIONAL}</NativeSelectOption><NativeSelectOption value="PROJECT">{EXPENSE_TYPE_LABEL.PROJECT}</NativeSelectOption></NativeSelect></Field>
        <Field className="w-full sm:w-44"><FieldLabel htmlFor="expense-category-filter">Kategori</FieldLabel><NativeSelect id="expense-category-filter" name="category" defaultValue={category} className="w-full"><NativeSelectOption value="all">Semua kategori</NativeSelectOption>{EXPENSE_CATEGORIES.map((value) => <NativeSelectOption key={value} value={value}>{EXPENSE_CATEGORY_LABEL[value]}</NativeSelectOption>)}</NativeSelect></Field>
        <Field className="w-full sm:w-36"><FieldLabel htmlFor="expense-method-filter">Metode</FieldLabel><NativeSelect id="expense-method-filter" name="method" defaultValue={method} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption>{methods.map((value) => <NativeSelectOption key={value.id} value={value.id}>{value.name}</NativeSelectOption>)}</NativeSelect></Field>
        <Button type="submit" variant="outline">Terapkan</Button>
          <Button variant="secondary" render={<Link href="/keuangan/pengeluaran" />} nativeButton={false}>Reset</Button>
        </form>
      </div>
      {data.groups.length ? <TableViewport className="min-h-0 flex-1">
        <Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto">
          <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted">
            <SortableTableHead label="Tanggal" href={dateSortHref(persistent, order)} active direction={order} />
            <TableHead>Keperluan</TableHead><TableHead>Customer</TableHead><TableHead>Kategori</TableHead><TableHead>Metode</TableHead><TableHead>Bukti</TableHead><TableHead>Dicatat oleh</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead>Deskripsi</TableHead><TableHead>Status Ganti</TableHead><TableHead className="w-48 text-right">Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.groups.flatMap((group) => {
            const totalRows = group.operasional.length + group.projects.reduce((sum, project) => sum + 1 + project.items.length, 0);
            let rowIndex = 0;
            const renderItem = (item: (typeof group.operasional)[number]) => {
              const own = item.createdById === actor?.id;
              const canManage = ["DEVELOPER", "OWNER", "KEUANGAN"].includes(actor?.role ?? "");
              const canDelete = own || Boolean(actor && hasRole(actor.role, OWNER_ACTION_ROLES));
              const reimbursable = item.isReimbursable;
              const showDate = rowIndex === 0;
              rowIndex += 1;
              return <TableRow key={item.id}>
                {showDate ? <TableCell rowSpan={totalRows}>{formatDate(group.spentAt)}</TableCell> : null}
                <TableCell>{item.purpose}</TableCell><TableCell>{item.customerName ?? "-"}</TableCell><TableCell>{EXPENSE_CATEGORY_LABEL[item.category]}</TableCell><TableCell>{item.paymentMethod.name}</TableCell><TableCell><PaymentProofPreview href={item.proofPath ? `/api/keuangan/pengeluaran/${item.id}/bukti` : null} mimeType={item.proofMimeType} label={`Bukti ${item.purpose}`} /></TableCell><TableCell>{item.createdBy.name}</TableCell><TableCell className={numericCellClass(item.amount, "text-right font-mono tabular-nums")}>{formatCurrency(item.amount)}</TableCell><TableCell>{item.description || "-"}</TableCell>
                <TableCell>{reimbursable ? item.reimbursedAt ? <span className="text-success">Diganti {formatDate(item.reimbursedAt, true)}</span> : "Belum diganti" : "-"}</TableCell>
                <TableCell className="text-right">{canManage && !item.reimbursedAt ? <div className="flex justify-end gap-2">
                  {reimbursable ? <form action={reimburseExpenseAction}><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton size="sm" variant="success" pendingLabel="Memproses..." confirmTitle="Tandai uang sudah diganti?" confirmDescription="Pengeluaran ini tidak dapat diedit atau dihapus setelah ditandai." confirmLabel="Ya, sudah diganti"><Check data-icon="inline-start" aria-hidden="true" />Reimburse</ConfirmSubmitButton></form> : null}
                  <ExpenseForm methods={methods} expense={item} />{canDelete ? <form action={deleteExpenseAction}><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton size="sm" variant="destructive" pendingLabel="Menghapus..." confirmTitle="Hapus pengeluaran?" confirmDescription="Data dipindah ke Riwayat Hapus dan tidak muncul di pencarian." confirmLabel="Ya, hapus"><Trash2 data-icon="inline-start" aria-hidden="true" />Hapus</ConfirmSubmitButton></form> : null}
                </div> : "-"}</TableCell>
              </TableRow>;
            };
            const nodes: ReactNode[] = [];
            group.operasional.forEach((item) => nodes.push(renderItem(item)));
            group.projects.forEach((project) => {
              const showDate = rowIndex === 0;
              rowIndex += 1;
              nodes.push(<TableRow key={`project-${group.spentAt.getTime()}-${project.key}`} className="bg-muted/60 hover:bg-muted/70">
                {showDate ? <TableCell rowSpan={totalRows}>{formatDate(group.spentAt)}</TableCell> : null}
                <TableCell colSpan={6} className="font-semibold">Project: {project.label}</TableCell>
                <TableCell className={numericCellClass(project.subtotal, "text-right font-mono font-semibold tabular-nums")}>{formatCurrency(project.subtotal)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>);
              project.items.forEach((item) => nodes.push(renderItem(item)));
            });
            return nodes;
          })}</TableBody>
          <TableFooter><TableRow><TableCell colSpan={7} className="font-semibold">Total (sesuai filter)</TableCell><TableCell className={numericCellClass(data.totalAmount, "text-right font-mono font-semibold tabular-nums")}>{formatCurrency(data.totalAmount)}</TableCell><TableCell colSpan={3} /></TableRow></TableFooter>
        </Table>
        <DataPagination pathname="/keuangan/pengeluaran" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={{ ...persistent, order: order === "desc" ? undefined : order }} className="border-t px-4 py-3" />
      </TableViewport> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada pengeluaran</EmptyTitle><EmptyDescription>Tambahkan catatan biaya melalui tombol Pengeluaran.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
