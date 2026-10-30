import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { ExportMenu } from "@/components/export/export-button";
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
import { hppProjectDescription, getIncome, getProjectExpensesBySalesOrders, type ProjectExpensePrefill } from "@/lib/finance/expense";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { groupProjectRows } from "@/lib/finance/project-groups";
import { getActivePaymentMethods } from "@/lib/master-data";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; status?: string | string[]; hppStatus?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const parseStatus = (value: string | undefined) => value === "DP" || value === "LUNAS" || value === "DEPOSIT" ? value : "all";

function sumMoney(values: Array<string | null | undefined>) {
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0);
}

const HPP_KEY_BY_LABEL: Record<string, string> = { Kain: "kain", Zipper: "zipper", Jahit: "jahit", Pres: "pres", "DTF/Plastisol": "dtfPlastisol", Bordir: "bordir", "Lain-lain": "lainnya" };

// Lebar kolom eksplisit supaya header dan isi selalu sejajar. Empat kolom
// identitas memakai CSS variable karena lebarnya mengecil di layar kecil dan
// offset `left` kolom beku harus persis mengikuti lebar kolom sebelumnya.
const PROJECT_COLUMN_WIDTHS = [
  "var(--project-date)",     // Tanggal
  "var(--project-customer)", // Customer
  "var(--project-order)",    // Nama order
  "var(--project-type)",     // Jenis order
  "3.5rem", // Qty
  "7rem",   // Kain
  "7rem",   // Zipper
  "7rem",   // Jahit
  "7rem",   // Pres
  "8.5rem", // DTF/Plastisol
  "7rem",   // Bordir
  "7rem",   // Lain-lain
  "11rem",  // Deskripsi
  "7.5rem", // Total HPP
  "8rem",   // Harga Asli
  "11rem",  // Diskon
  "6.5rem", // Pajak
  "8rem",   // Total Invoice
  "8rem",   // Laba Bersih
  "5.5rem", // Margin %
  "7rem",   // Deposit
  "7rem",   // DP
  "7rem",   // Lunas
  "8rem",   // Keterangan
  "7rem",   // Status
  "7.5rem", // Aksi
] as const;

/*
  Kolom identitas dibekukan saat tabel digeser ke samping. Di bawah `lg` hanya
  Tanggal + Customer yang beku supaya HP masih punya ruang untuk menggeser kolom
  lain; mulai `lg` keempat kolom ikut beku. Offset tiap kolom dihitung dari lebar
  kolom di depannya, jadi nilainya harus sama dengan `PROJECT_COLUMN_WIDTHS`.
*/
const PROJECT_STICKY_LEFT = [
  "0px",
  "var(--project-date)",
  "calc(var(--project-date) + var(--project-customer))",
  "calc(var(--project-date) + var(--project-customer) + var(--project-order))",
] as const;

// Header dan sel beku butuh latar solid; tanpa itu teks yang tergeser tembus.
// Garis batas memakai inset shadow karena border pada sel sticky tidak selalu
// ikut bergerak saat `border-collapse: collapse` (perilaku Chromium) — termasuk
// garis antar-baris, yang harus digambar ulang di sel beku. Nama kelas ditulis
// utuh (bukan dirangkai) supaya tetap terbaca pemindai Tailwind.
const PROJECT_STICKY_HEAD = [
  "sticky left-0 z-20 bg-muted",
  "sticky z-20 bg-muted shadow-[inset_-1px_0_0_var(--border)] lg:shadow-none",
  "lg:sticky lg:z-20 lg:bg-muted",
  "lg:sticky lg:z-20 lg:bg-muted lg:shadow-[inset_-1px_0_0_var(--border)]",
] as const;
const PROJECT_STICKY_CELL = [
  "sticky left-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] group-hover/row:bg-highlight-surface",
  "sticky z-10 bg-card shadow-[inset_-1px_0_0_var(--border),inset_0_-1px_0_var(--border)] group-hover/row:bg-highlight-surface lg:shadow-[inset_0_-1px_0_var(--border)]",
  "lg:sticky lg:z-10 lg:bg-card lg:shadow-[inset_0_-1px_0_var(--border)] lg:group-hover/row:bg-highlight-surface",
  "lg:sticky lg:z-10 lg:bg-card lg:shadow-[inset_-1px_0_0_var(--border),inset_0_-1px_0_var(--border)] lg:group-hover/row:bg-highlight-surface",
] as const;

// 163rem = total 22 kolom yang tidak dibekukan (196,5rem − 33,5rem).
const PROJECT_TABLE_VARS = "[--project-date:5.5rem] [--project-customer:6.5rem] [--project-order:8rem] [--project-type:7rem] xl:[--project-date:7rem] xl:[--project-customer:8rem] xl:[--project-order:10rem] xl:[--project-type:8.5rem]";
const PROJECT_TABLE_WIDTH = "calc(163rem + var(--project-date) + var(--project-customer) + var(--project-order) + var(--project-type))";

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
  // Prefill dan Deskripsi kini per produk. Expense lama tanpa tautan produk
  // ditempatkan pada produk pertama agar tidak hilang sebelum/sesudah migrasi.
  const productPrefill = new Map<string, Partial<Record<string, HppProjectPrefill[]>>>();
  const productDescription = new Map<string, string>();
  for (const item of data.items) {
    const fallbackCostId = item.products.find((product) => product.costId)?.costId ?? null;
    const rowsByCost = new Map<string, ProjectExpensePrefill[]>();
    for (const row of projectRows.get(item.id) ?? []) {
      const costId = row.salesOrderProductCostId ?? fallbackCostId;
      if (!costId) continue;
      const list = rowsByCost.get(costId) ?? [];
      list.push(row);
      rowsByCost.set(costId, list);
    }
    for (const product of item.products) {
      if (!product.costId) continue;
      const rows = rowsByCost.get(product.costId) ?? [];
      const prefill: Partial<Record<string, HppProjectPrefill[]>> = {};
      for (const row of rows) {
        const key = projectPrefillKey(row);
        if (!key) continue;
        (prefill[key] ??= []).push({ id: row.id, spentAt: row.spentAt, paymentMethodId: row.paymentMethodId, description: row.description, amount: row.amount, proofPath: row.proofPath, proofFileName: row.proofFileName, proofMimeType: row.proofMimeType });
      }
      productPrefill.set(product.costId, prefill);
      productDescription.set(product.costId, hppProjectDescription(rows));
    }
  }
  const projectGroups = groupProjectRows(data.items);
  const persistent = { q: query || undefined, from: range.from || undefined, to: range.to || undefined, status: status === "all" ? undefined : status, hppStatus: hppStatus === "all" ? undefined : hppStatus, pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };
  const exportParams = Object.fromEntries(Object.entries(persistent).filter((entry): entry is [string, string] => Boolean(entry[1])));
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
    <PageHeader title="Project" description="Pantau pembayaran Invoice, HPP, laba, dan sisa pembayaran order customer. Isi HPP dapat otomatis masuk ke Pengeluaran kategori Project." action={<ExportMenu label="Export Excel" params={exportParams} items={[
      { workbookScope: "pemasukan", label: "Project & DP (workbook)" },
      { dataset: "mutasi-pembayaran", label: "Mutasi pembayaran", params: { q: exportParams.q, from: exportParams.from, to: exportParams.to } },
      { dataset: "rincian-hpp", label: "Rincian HPP", params: { q: exportParams.q, from: exportParams.from, to: exportParams.to } },
    ]} />} />
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
        <Table className={`${PROJECT_TABLE_VARS} table-fixed`} style={{ width: PROJECT_TABLE_WIDTH }} containerClassName="min-h-0 flex-1 overflow-auto">
          <colgroup>
            {PROJECT_COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
          <TableHeader className="sticky top-0 z-20 bg-muted">
            <TableRow className="hover:bg-muted">
              <TableHead className={PROJECT_STICKY_HEAD[0]} style={{ left: PROJECT_STICKY_LEFT[0] }}>Tanggal</TableHead>
              <TableHead className={PROJECT_STICKY_HEAD[1]} style={{ left: PROJECT_STICKY_LEFT[1] }}>Customer</TableHead>
              <TableHead className={PROJECT_STICKY_HEAD[2]} style={{ left: PROJECT_STICKY_LEFT[2] }}>Nama order</TableHead>
              <TableHead className={PROJECT_STICKY_HEAD[3]} style={{ left: PROJECT_STICKY_LEFT[3] }}>Jenis order</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              {["Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}
              <TableHead>Deskripsi</TableHead>
              {["Total HPP", "Harga Asli", "Diskon", "Pajak", "Total Invoice", "Laba Bersih", "Margin %", "Deposit", "DP", "Lunas"].map((label) => <TableHead key={label} className="text-right" title={label === "Diskon" ? "Diskon total (termasuk pembulatan) = diskon produk + diskon order" : undefined}>{label}</TableHead>)}
              <TableHead>Keterangan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectGroups.map((dateGroup) => dateGroup.customers.map((customerGroup, customerIndex) => customerGroup.orders.map((orderGroup, orderIndex) => {
              const item = orderGroup.item;
              const itemDiscountValue = Number(item.itemDiscount);
              const orderDiscountValue = Number(item.orderDiscount);
              // totalDiscount juga memuat penyesuaian pembulatan ke Rp500.
              const roundingDiscount = Number(item.discount) - itemDiscountValue - orderDiscountValue;
              const hasRoundingDiscount = Math.abs(roundingDiscount) >= 1;
              return item.products.map((product, productIndex) => {
                // Tanggal hanya di baris pertama date group; customer di baris
                // pertama setiap customer group (bukan hanya customer pertama).
                const showDate = customerIndex === 0 && orderIndex === 0 && productIndex === 0;
                const showCustomer = orderIndex === 0 && productIndex === 0;
                const showOrder = productIndex === 0;
                return <TableRow key={`${item.id}:${product.key}:${productIndex}`} className="group/row">
                  {showDate ? <TableCell rowSpan={dateGroup.rowCount} className={`${PROJECT_STICKY_CELL[0]} align-middle whitespace-nowrap`} style={{ left: PROJECT_STICKY_LEFT[0] }}>{dateGroup.paidAt ? formatDate(dateGroup.paidAt) : "-"}</TableCell> : null}
                  {showCustomer ? <TableCell rowSpan={customerGroup.rowCount} className={`${PROJECT_STICKY_CELL[1]} align-middle whitespace-normal break-words`} style={{ left: PROJECT_STICKY_LEFT[1] }}>{customerGroup.customer}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className={`${PROJECT_STICKY_CELL[2]} align-middle whitespace-normal break-words`} style={{ left: PROJECT_STICKY_LEFT[2] }}>{item.orderName}</TableCell> : null}
                  <TableCell className={`${PROJECT_STICKY_CELL[3]} align-middle whitespace-normal break-words`} style={{ left: PROJECT_STICKY_LEFT[3] }}>
                    <div className="font-medium">{product.label}</div>
                    {product.label !== product.productName ? <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{product.productName}</div> : null}
                  </TableCell>
                  <TableCell className="align-middle text-right font-mono tabular-nums">{product.quantity}</TableCell>
                  {[product.kain, product.zipper, product.jahit, product.pres, product.dtfPlastisol, product.bordir, product.lainnya].map((value, index) => <TableCell key={index} className="align-middle text-right font-mono tabular-nums">{value === null || Number(value) === 0 ? "-" : formatCurrency(value)}</TableCell>)}
                  <TableCell className="align-middle whitespace-pre-line break-words text-xs leading-relaxed">{product.costId ? productDescription.get(product.costId) || "-" : "-"}</TableCell>
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.hpp === null || Number(item.hpp) === 0 ? "-" : formatCurrency(item.hpp)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{formatCurrency(item.originalPrice)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums" title="Diskon total (termasuk pembulatan) = diskon produk + diskon order">
                    <div>{formatCurrency(item.discount)}</div>
                    {itemDiscountValue > 0 || orderDiscountValue > 0 ? <div className="mt-1 whitespace-normal font-sans text-[11px] leading-tight text-muted-foreground">
                      {itemDiscountValue > 0 ? <div>Produk {formatCurrency(item.itemDiscount)}</div> : null}
                      {orderDiscountValue > 0 ? <div>Total {formatCurrency(item.orderDiscount)}</div> : null}
                      {hasRoundingDiscount ? <div>Pembulatan {formatCurrency(roundingDiscount)}</div> : null}
                    </div> : null}
                  </TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{formatCurrency(item.tax)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{formatCurrency(item.totalInvoice)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.netProfit === null ? "-" : formatCurrency(item.netProfit)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.margin === null ? "-" : formatPercentage(item.margin)}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.deposit ? formatCurrency(item.deposit) : "-"}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.dp ? formatCurrency(item.dp) : "-"}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle text-right font-mono tabular-nums">{item.settled ? formatCurrency(item.settled) : "-"}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle">{item.remaining === "0" ? "Lunas" : `Sisa ${formatCurrency(item.remaining)}`}</TableCell> : null}
                  {showOrder ? <TableCell rowSpan={orderGroup.rowCount} className="align-middle">{item.costVersion !== null ? <HppCompleteSwitch salesOrderId={item.id} version={item.costVersion} checked={item.hppComplete} /> : <span className="text-muted-foreground">-</span>}</TableCell> : null}
                  <TableCell className="align-middle text-right">
                    {/* Semua produk bisa Edit HPP. Kalau baris HPP per produk
                        belum ada (data impor lama), aksi simpan yang membuatnya
                        berdasarkan (salesOrderId, productName). */}
                    <SalesOrderCostForm item={{ id: item.id, productCostId: product.costId, productName: product.productName, costVersion: product.costVersion, kain: product.kain, zipper: product.zipper, jahit: product.jahit, pres: product.pres, dtfPlastisol: product.dtfPlastisol, bordir: product.bordir, lainnya: product.lainnya }} methods={methods} projectExpenses={product.costId ? productPrefill.get(product.costId) : undefined} />
                  </TableCell>
                </TableRow>;
              });
            })))}
          </TableBody>
          <TableFooter>
            <TableRow className="border-t bg-muted hover:bg-muted">
              <TableCell colSpan={4} className="font-medium">Total</TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{totalQuantity}</TableCell>
              {numericTotals.slice(0, 7).map((value, index) => <TableCell key={index} className="text-right font-mono font-medium tabular-nums">{value === 0 ? "-" : formatCurrency(value)}</TableCell>)}
              <TableCell />
              {numericTotals.slice(7).map((value, index) => <TableCell key={index} className="text-right font-mono font-medium tabular-nums">{value === 0 ? "-" : formatCurrency(value)}</TableCell>)}
              <TableCell className="text-right font-mono font-medium tabular-nums">{totalMargin === null ? "-" : formatPercentage(totalMargin)}</TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{totalDeposit === 0 ? "-" : formatCurrency(totalDeposit)}</TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{totalDp === 0 ? "-" : formatCurrency(totalDp)}</TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{totalSettled === 0 ? "-" : formatCurrency(totalSettled)}</TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
        <DataPagination pathname="/keuangan/pemasukan" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
      </div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada project</EmptyTitle><EmptyDescription>Invoice dengan pembayaran aktif akan tampil di sini.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </>;
}
