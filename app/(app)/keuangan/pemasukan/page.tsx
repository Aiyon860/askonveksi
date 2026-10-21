import Link from "next/link";
import { Download, ReceiptText } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { HppCompleteSwitch } from "@/components/finance/hpp-complete-switch";
import { SalesOrderCostForm, type HppProjectPrefill } from "@/components/finance/sales-order-cost-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/crm/format";
import { hppProjectDescription, getIncome, getProjectExpensesBySalesOrders } from "@/lib/finance/expense";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { getActivePaymentMethods } from "@/lib/master-data";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; status?: string | string[]; hppStatus?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const parseStatus = (value: string | undefined) => value === "DP" || value === "LUNAS" || value === "DEPOSIT" ? value : "all";

function sumMoney(values: Array<string | null | undefined>) {
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0);
}

const HPP_KEY_BY_LABEL: Record<string, string> = { Kain: "kain", Zipper: "zipper", Jahit: "jahit", Pres: "pres", "DTF/Plastisol": "dtfPlastisol", Bordir: "bordir", "Lain-lain": "lainnya" };

function projectPrefillKey(row: { hppKey: string | null; purpose: string }) {
  if (row.hppKey) return row.hppKey;
  const match = row.purpose.match(/^HPP (.+?) ·/);
  return (match && HPP_KEY_BY_LABEL[match[1]]) || "";
}

export default async function IncomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  // Tanpa filter tanggal = tampilkan semua pemasukan (bukan default bulan berjalan).
  const range = parseOptionalFinanceDateRange(params.from, params.to);
  const status = parseStatus(first(params.status));
  const hppStatus = first(params.hppStatus) === "COMPLETE" ? "COMPLETE" : first(params.hppStatus) === "INCOMPLETE" ? "INCOMPLETE" : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const [data, methods] = await Promise.all([getIncome({ query, from: range.start, to: range.end, status, hppStatus, page, pageSize }), getActivePaymentMethods()]);
  const projectRows = await getProjectExpensesBySalesOrders(data.items.map((item) => item.id));
  // Prefill multi-baris (R15): semua baris per jenis diurutkan createdAt asc, bukan baris pertama saja.
  const projectPrefill = new Map(data.items.map((item) => {
    const prefill: Partial<Record<string, HppProjectPrefill[]>> = {};
    for (const row of projectRows.get(item.id) ?? []) {
      const key = projectPrefillKey(row);
      if (!key) continue;
      (prefill[key] ??= []).push({ id: row.id, spentAt: row.spentAt, paymentMethodId: row.paymentMethodId, description: row.description, amount: row.amount, proofPath: row.proofPath, proofFileName: row.proofFileName, proofMimeType: row.proofMimeType });
    }
    return [item.id, prefill] as const;
  }));
  // R17 — kolom Deskripsi per order: gabung baris HPP terisi.
  const projectDescription = new Map(data.items.map((item) => [item.id, hppProjectDescription(projectRows.get(item.id) ?? [])]));
  const persistent = { q: query || undefined, from: range.from || undefined, to: range.to || undefined, status: status === "all" ? undefined : status, hppStatus: hppStatus === "all" ? undefined : hppStatus, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  const exportParams = new URLSearchParams(Object.entries(persistent).filter((entry): entry is [string, string] => Boolean(entry[1])));
  // Total dihitung dari seluruh baris data yang dimuat halaman ini (data.items).
  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const numericTotals = [
    sumMoney(data.items.map((item) => item.kain)),
    sumMoney(data.items.map((item) => item.zipper)),
    sumMoney(data.items.map((item) => item.jahit)),
    sumMoney(data.items.map((item) => item.pres)),
    sumMoney(data.items.map((item) => item.dtfPlastisol)),
    sumMoney(data.items.map((item) => item.bordir)),
    sumMoney(data.items.map((item) => item.lainnya)),
    sumMoney(data.items.map((item) => item.hpp)),
    sumMoney(data.items.map((item) => item.originalPrice)),
    sumMoney(data.items.map((item) => item.discount)),
    sumMoney(data.items.map((item) => item.tax)),
    sumMoney(data.items.map((item) => item.totalInvoice)),
    sumMoney(data.items.map((item) => item.netProfit)),
  ];
  const totalInvoiceValue = sumMoney(data.items.map((item) => item.totalInvoice));
  const totalNetProfitValue = sumMoney(data.items.map((item) => item.netProfit));
  const totalMargin = totalInvoiceValue ? totalNetProfitValue / totalInvoiceValue : null;
  const totalDeposit = sumMoney(data.items.map((item) => item.deposit));
  const totalDp = sumMoney(data.items.map((item) => item.dp));
  const totalSettled = sumMoney(data.items.map((item) => item.settled));

  return <>
    <PageHeader title="Project" description="Pantau pembayaran Invoice, HPP, laba, dan sisa pembayaran order customer. Isi HPP dapat otomatis masuk ke Pengeluaran kategori Project." action={<Button variant="outline" render={<a href={`/api/keuangan/pemasukan/export?${exportParams}`} />} nativeButton={false}><Download data-icon="inline-start" aria-hidden="true" />Export Excel</Button>} />
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <DebouncedSearchInput key={query} initialValue={query} pathname="/keuangan/pemasukan" params={persistent} placeholder="Cari customer, invoice, atau order..." ariaLabel="Cari pemasukan" className="lg:max-w-md" />
        <form action="/keuangan/pemasukan" className="flex flex-wrap items-end gap-2 lg:justify-end">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-from">Dari tanggal</FieldLabel><Input id="income-from" name="from" type="date" defaultValue={range.from} /></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-to">Sampai tanggal</FieldLabel><Input id="income-to" name="to" type="date" defaultValue={range.to} /></Field>
          <Field className="w-36 gap-1"><FieldLabel htmlFor="income-status">Pembayaran</FieldLabel><NativeSelect id="income-status" name="status" defaultValue={status} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption><NativeSelectOption value="DEPOSIT">Deposit</NativeSelectOption><NativeSelectOption value="DP">DP</NativeSelectOption><NativeSelectOption value="LUNAS">Lunas</NativeSelectOption></NativeSelect></Field>
          <Field className="w-40 gap-1"><FieldLabel htmlFor="income-hpp-status">Status HPP</FieldLabel><NativeSelect id="income-hpp-status" name="hppStatus" defaultValue={hppStatus} className="w-full"><NativeSelectOption value="all">Semua</NativeSelectOption><NativeSelectOption value="COMPLETE">Lengkap</NativeSelectOption><NativeSelectOption value="INCOMPLETE">Belum Lengkap</NativeSelectOption></NativeSelect></Field>
          <Button type="submit" variant="outline">Terapkan</Button>
          <Button variant="secondary" render={<Link href="/keuangan/pemasukan" />} nativeButton={false}>Reset</Button>
          <p className="self-center text-xs text-muted-foreground"><strong className="font-medium text-foreground">{data.total}</strong> invoice berbayar</p>
        </form>
      </div>
      {data.items.length ? <div className="flex min-h-112 flex-1 flex-col">
        <Table className="min-w-[180rem]" containerClassName="min-h-0 flex-1 overflow-auto"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead>Tanggal</TableHead><TableHead>Customer</TableHead><TableHead>Nama order</TableHead><TableHead>Jenis busana</TableHead><TableHead className="text-right">Total QTY</TableHead>{["Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}<TableHead>Deskripsi</TableHead>{["Total HPP", "Harga Asli", "Diskon", "Pajak", "Total Invoice", "Laba Bersih", "Margin %", "Deposit", "DP", "Lunas"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}<TableHead>Keterangan</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{data.items.map((item) => <TableRow key={item.id}><TableCell>{item.paidAt ? formatDate(item.paidAt) : "-"}</TableCell><TableCell>{item.customer}</TableCell><TableCell>{item.orderName}</TableCell><TableCell>{item.garmentType}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>{[item.kain, item.zipper, item.jahit, item.pres, item.dtfPlastisol, item.bordir, item.lainnya].map((value, index) => <TableCell key={index} className="text-right font-mono tabular-nums">{value === null ? "-" : formatCurrency(value)}</TableCell>)}<TableCell className="max-w-80 whitespace-pre-line break-words text-xs leading-relaxed">{projectDescription.get(item.id) || "-"}</TableCell>{[item.hpp, item.originalPrice, item.discount, item.tax, item.totalInvoice, item.netProfit].map((value, index) => <TableCell key={index} className="text-right font-mono tabular-nums">{value === null ? "-" : formatCurrency(value)}</TableCell>)}<TableCell className="text-right font-mono tabular-nums">{item.margin === null ? "-" : formatPercentage(item.margin)}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.deposit ? formatCurrency(item.deposit) : "-"}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.dp ? formatCurrency(item.dp) : "-"}</TableCell><TableCell className="text-right font-mono tabular-nums">{item.settled ? formatCurrency(item.settled) : "-"}</TableCell><TableCell>{item.remaining === "0" ? "Lunas" : `Sisa ${formatCurrency(item.remaining)}`}</TableCell><TableCell>{item.costVersion !== null ? <HppCompleteSwitch salesOrderId={item.id} version={item.costVersion} checked={item.hppComplete} /> : <span className="text-muted-foreground">-</span>}</TableCell><TableCell className="text-right">{item.costVersion !== null ? <SalesOrderCostForm item={{ ...item, costVersion: item.costVersion }} methods={methods} projectExpenses={projectPrefill.get(item.id)} /> : "-"}</TableCell></TableRow>)}</TableBody><TableFooter><TableRow className="border-t bg-muted hover:bg-muted"><TableCell colSpan={4} className="font-medium">Total</TableCell><TableCell className="text-right font-mono font-medium tabular-nums">{totalQuantity}</TableCell>{numericTotals.slice(0, 7).map((value, index) => <TableCell key={index} className="text-right font-mono font-medium tabular-nums">{formatCurrency(value)}</TableCell>)}<TableCell />{numericTotals.slice(7).map((value, index) => <TableCell key={index} className="text-right font-mono font-medium tabular-nums">{formatCurrency(value)}</TableCell>)}<TableCell className="text-right font-mono font-medium tabular-nums">{totalMargin === null ? "-" : formatPercentage(totalMargin)}</TableCell><TableCell className="text-right font-mono font-medium tabular-nums">{formatCurrency(totalDeposit)}</TableCell><TableCell className="text-right font-mono font-medium tabular-nums">{formatCurrency(totalDp)}</TableCell><TableCell className="text-right font-mono font-medium tabular-nums">{formatCurrency(totalSettled)}</TableCell><TableCell /><TableCell /><TableCell /></TableRow></TableFooter></Table>
        <DataPagination pathname="/keuangan/pemasukan" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
      </div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada project</EmptyTitle><EmptyDescription>Invoice dengan pembayaran aktif akan tampil di sini.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
