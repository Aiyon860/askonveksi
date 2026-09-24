import Link from "next/link";
import { Download, ReceiptText } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { SalesOrderCostForm } from "@/components/finance/sales-order-cost-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercentage } from "@/lib/crm/format";
import { getIncome } from "@/lib/finance/expense";
import { parseFinanceDateRange } from "@/lib/finance/date-range";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; status?: string | string[]; hppStatus?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function IncomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const range = parseFinanceDateRange(params.from, params.to);
  const status = first(params.status) === "DP" ? "DP" : first(params.status) === "LUNAS" ? "LUNAS" : "all";
  const hppStatus = first(params.hppStatus) === "COMPLETE" ? "COMPLETE" : first(params.hppStatus) === "INCOMPLETE" ? "INCOMPLETE" : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const data = await getIncome({ query, from: range.start, to: range.end, status, hppStatus, page, pageSize });
  const persistent = { q: query || undefined, from: range.from, to: range.to, status: status === "all" ? undefined : status, hppStatus: hppStatus === "all" ? undefined : hppStatus, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  const exportParams = new URLSearchParams(Object.entries(persistent).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return <>
    <PageHeader title="Pemasukan" description="Pantau pembayaran Invoice, HPP, laba, dan sisa pembayaran order customer." action={<Button variant="outline" render={<a href={`/api/keuangan/pemasukan/export?${exportParams}`} />} nativeButton={false}><Download data-icon="inline-start" aria-hidden="true" />Export Excel</Button>} />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <DebouncedSearchInput key={query} initialValue={query} pathname="/keuangan/pemasukan" params={persistent} placeholder="Cari customer, invoice, atau order..." ariaLabel="Cari pemasukan" className="lg:max-w-md" />
        <form action="/keuangan/pemasukan" className="flex flex-wrap items-end gap-2 lg:justify-end">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-from">Dari tanggal</FieldLabel><Input id="income-from" name="from" type="date" defaultValue={range.from} /></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-to">Sampai tanggal</FieldLabel><Input id="income-to" name="to" type="date" defaultValue={range.to} /></Field>
          <Field className="w-36 gap-1"><FieldLabel htmlFor="income-status">Pembayaran</FieldLabel><NativeSelect id="income-status" name="status" defaultValue={status} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption><NativeSelectOption value="DP">DP</NativeSelectOption><NativeSelectOption value="LUNAS">Lunas</NativeSelectOption></NativeSelect></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-hpp-status">Status HPP</FieldLabel><NativeSelect id="income-hpp-status" name="hppStatus" defaultValue={hppStatus} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption><NativeSelectOption value="COMPLETE">Lengkap</NativeSelectOption><NativeSelectOption value="INCOMPLETE">Belum Lengkap</NativeSelectOption></NativeSelect></Field>
          <Button type="submit" variant="outline">Terapkan</Button>
          <Button variant="secondary" render={<Link href="/keuangan/pemasukan" />} nativeButton={false}>Reset</Button>
          <p className="self-center text-xs text-muted-foreground"><strong className="font-medium text-foreground">{data.total}</strong> invoice berbayar</p>
        </form>
      </div>
      {data.items.length ? <div className="flex min-h-112 flex-1 flex-col">
        <Table className="min-w-[170rem]" containerClassName="min-h-0 flex-1 overflow-auto"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead>Customer</TableHead><TableHead>Nama order</TableHead><TableHead>Jenis busana</TableHead><TableHead className="text-right">Total QTY</TableHead>{["Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain", "Total HPP", "Diskon", "Total Invoice", "Laba Bersih", "Margin", "DP", "Lunas"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}<TableHead>Keterangan</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{data.items.map((item) => <TableRow key={item.id}><TableCell>{item.customer}</TableCell><TableCell>{item.orderName}</TableCell><TableCell>{item.garmentType}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>{[item.kain, item.zipper, item.jahit, item.pres, item.dtfPlastisol, item.bordir, item.lainnya, item.hpp, item.discount, item.totalInvoice, item.netProfit].map((value, index) => <TableCell key={index} className="text-right font-mono tabular-nums">{value === null ? "-" : formatCurrency(value)}</TableCell>)}<TableCell className="text-right font-mono tabular-nums">{item.margin === null ? "-" : formatPercentage(item.margin)}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.dp ? formatCurrency(item.dp) : "-"}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.settled ? formatCurrency(item.settled) : "-"}</TableCell><TableCell>{item.remaining === "0" ? "Lunas" : `Sisa ${formatCurrency(item.remaining)}`}</TableCell><TableCell>{item.hppStatus === "COMPLETE" ? "Lengkap" : "Belum Lengkap"}</TableCell><TableCell className="text-right">{item.costVersion !== null ? <SalesOrderCostForm item={{ ...item, costVersion: item.costVersion }} /> : "-"}</TableCell></TableRow>)}</TableBody></Table>
        <DataPagination pathname="/keuangan/pemasukan" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
      </div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada pemasukan</EmptyTitle><EmptyDescription>Invoice dengan pembayaran aktif akan tampil di sini.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
