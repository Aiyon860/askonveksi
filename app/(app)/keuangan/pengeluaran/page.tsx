import Link from "next/link";
import { Check, Download, ReceiptText, Trash2 } from "lucide-react";

import { deleteExpenseAction, reimburseExpenseAction } from "@/app/actions/finance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ExpenseForm } from "@/components/finance/expense-form";
import { PaymentProofPreview } from "@/components/payment-proof-preview";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { getExpenses } from "@/lib/finance/expense";
import { EXPENSE_METHOD_LABEL, EXPENSE_METHODS } from "@/lib/finance/expense-methods";
import { parseFinanceDateRange } from "@/lib/finance/date-range";
import { getCurrentActor } from "@/lib/auth/session";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; category?: string | string[]; method?: string | string[]; creator?: string | string[]; order?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
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
  const rawMethod = first(params.method);
  const method = EXPENSE_METHODS.includes(rawMethod as never) ? rawMethod as (typeof EXPENSE_METHODS)[number] : "all";
  const creatorId = first(params.creator) ?? "all";
  const order = first(params.order) === "asc" ? "asc" : "desc";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const [data, actor] = await Promise.all([getExpenses({ query, from: range?.start ?? null, to: range?.end ?? null, category, method, creatorId, order, page, pageSize }), getCurrentActor()]);
  const persistent = { q: query || undefined, from: range?.from, to: range?.to, category: category === "all" ? undefined : category, method: method === "all" ? undefined : method, creator: creatorId === "all" ? undefined : creatorId, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  const exportParams = new URLSearchParams(Object.entries(persistent).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return <>
    <PageHeader title="Pengeluaran" description="Catat dan lacak biaya operasional yang digunakan." action={<div className="flex items-center gap-2"><Button variant="outline" render={<a href={`/api/keuangan/pengeluaran/export?${exportParams}`} />} nativeButton={false}><Download data-icon="inline-start" aria-hidden="true" />Export Excel</Button><ExpenseForm /></div>} />
    <PageMessage />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <DebouncedSearchInput key={query} initialValue={query} pathname="/keuangan/pengeluaran" params={persistent} placeholder="Cari keperluan pengeluaran..." ariaLabel="Cari pengeluaran" className="lg:max-w-md" />
        <form action="/keuangan/pengeluaran" className="flex flex-wrap items-end gap-2 lg:justify-end">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {order !== "desc" ? <input type="hidden" name="order" value={order} /> : null}
          {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        <Field className="w-full sm:w-40"><FieldLabel htmlFor="expense-from">Dari tanggal</FieldLabel><Input id="expense-from" name="from" type="date" defaultValue={range?.from ?? ""} /></Field>
        <Field className="w-full sm:w-40"><FieldLabel htmlFor="expense-to">Sampai tanggal</FieldLabel><Input id="expense-to" name="to" type="date" defaultValue={range?.to ?? ""} /></Field>
        <Field className="w-full sm:w-44"><FieldLabel htmlFor="expense-category-filter">Kategori</FieldLabel><NativeSelect id="expense-category-filter" name="category" defaultValue={category} className="w-full"><NativeSelectOption value="all">Semua kategori</NativeSelectOption>{EXPENSE_CATEGORIES.map((value) => <NativeSelectOption key={value} value={value}>{EXPENSE_CATEGORY_LABEL[value]}</NativeSelectOption>)}</NativeSelect></Field>
        <Field className="w-full sm:w-36"><FieldLabel htmlFor="expense-method-filter">Metode</FieldLabel><NativeSelect id="expense-method-filter" name="method" defaultValue={method} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption>{EXPENSE_METHODS.map((value) => <NativeSelectOption key={value} value={value}>{EXPENSE_METHOD_LABEL[value]}</NativeSelectOption>)}</NativeSelect></Field>
        <Field className="w-full sm:w-44"><FieldLabel htmlFor="expense-creator">Pembuat</FieldLabel><NativeSelect id="expense-creator" name="creator" defaultValue={creatorId} className="w-full"><NativeSelectOption value="all">Semua pengguna</NativeSelectOption>{data.creators.map((creator) => <NativeSelectOption key={creator.id} value={creator.id}>{creator.name}</NativeSelectOption>)}</NativeSelect></Field>
        <Button type="submit" variant="outline">Terapkan</Button>
          <Button variant="secondary" render={<Link href="/keuangan/pengeluaran" />} nativeButton={false}>Reset</Button>
        </form>
      </div>
      {data.groups.length ? <div className="flex min-h-112 flex-1 flex-col">
        <Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto">
          <TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted">
            <SortableTableHead label="Tanggal" href={dateSortHref(persistent, order)} active direction={order} />
            <TableHead>Keperluan</TableHead><TableHead>Kategori</TableHead><TableHead>Metode</TableHead><TableHead>Bukti</TableHead><TableHead>Dicatat oleh</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead>Status Pribadi</TableHead><TableHead className="w-48 text-right">Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.groups.flatMap((group) => group.items.map((item, index) => {
            const own = item.createdById === actor?.id;
            const canManage = ["DEVELOPER", "OWNER", "KEUANGAN"].includes(actor?.role ?? "");
            const personal = item.paymentMethod === "PRIBADI";
            return <TableRow key={item.id}>
              {index === 0 ? <TableCell rowSpan={group.items.length}>{formatDate(group.spentAt)}</TableCell> : null}
              <TableCell>{item.purpose}</TableCell><TableCell>{EXPENSE_CATEGORY_LABEL[item.category]}</TableCell><TableCell>{EXPENSE_METHOD_LABEL[item.paymentMethod]}</TableCell><TableCell><PaymentProofPreview href={item.proofPath ? `/api/keuangan/pengeluaran/${item.id}/bukti` : null} mimeType={item.proofMimeType} label={`Bukti ${item.purpose}`} /></TableCell><TableCell>{item.createdBy.name}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.amount)}</TableCell>
              <TableCell>{personal ? item.reimbursedAt ? <span className="text-success">Diganti {formatDate(item.reimbursedAt, true)}</span> : "Belum diganti" : "-"}</TableCell>
              <TableCell className="text-right">{canManage && !item.reimbursedAt ? <div className="flex justify-end gap-2">
                {personal ? <form action={reimburseExpenseAction}><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton size="sm" variant="outline" pendingLabel="Memproses..." confirmTitle="Tandai uang sudah diganti?" confirmDescription="Pengeluaran ini tidak dapat diedit atau dihapus setelah ditandai." confirmLabel="Ya, sudah diganti"><Check data-icon="inline-start" aria-hidden="true" />Sudah diganti</ConfirmSubmitButton></form> : null}
                <ExpenseForm expense={item} />{own ? <form action={deleteExpenseAction}><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton size="sm" variant="destructive" pendingLabel="Menghapus..." confirmTitle="Hapus pengeluaran?" confirmDescription="Catatan pengeluaran ini akan dihapus." confirmLabel="Ya, hapus"><Trash2 data-icon="inline-start" aria-hidden="true" />Hapus</ConfirmSubmitButton></form> : null}
              </div> : "-"}</TableCell>
            </TableRow>;
          }))}</TableBody>
        </Table>
        <DataPagination pathname="/keuangan/pengeluaran" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={{ ...persistent, order: order === "desc" ? undefined : order }} className="border-t px-4 py-3" />
      </div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada pengeluaran</EmptyTitle><EmptyDescription>Tambahkan catatan biaya melalui tombol Pengeluaran.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
