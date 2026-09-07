/*
THESIS: Keuangan v1 adalah meja cek uang masuk dari order Deal, bukan buku akuntansi penuh.
OWN-WORLD: Ruang Kendali Konveksi dengan angka mono, permukaan tonal, dan tabel audit yang ringkas.
STORY: Owner/Admin memilih rentang tanggal, membaca uang masuk, lalu menelusuri transaksi dan sisa pembayaran.
FIRST VIEWPORT: Filter tanggal diikuti strip metrik dengan uang masuk sebagai nilai utama.
FORM: Laporan operasional code-led, ENERGY 1 / RHYTHM 2 / MOTION 1.
*/
import Link from "next/link";
import { Suspense } from "react";
import { CircleDollarSign, FileSearch, HandCoins, ReceiptText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinanceOverviewData } from "@/lib/finance/data";
import { formatCurrency, formatDate } from "@/lib/crm/format";

type SearchParams = Promise<{ from?: string | string[]; to?: string | string[] }>;

export const revalidate = 30;

async function FinanceOverview({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = await getFinanceOverviewData(params);
  const hasTransactions = data.transactions.length > 0;
  const hasOutstandingOrders = data.outstandingOrders.length > 0;

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Rentang laporan</CardTitle>
          <CardDescription>Uang masuk mengikuti tanggal transaksi pembayaran aktif.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get">
            <FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end">
              <Field className="sm:max-w-48">
                <FieldLabel htmlFor="from">Dari tanggal</FieldLabel>
                <Input id="from" name="from" type="date" defaultValue={data.range.from} />
              </Field>
              <Field className="sm:max-w-48">
                <FieldLabel htmlFor="to">Sampai tanggal</FieldLabel>
                <Input id="to" name="to" type="date" defaultValue={data.range.to} />
              </Field>
              <Button type="submit" variant="outline">Terapkan rentang</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="finance-summary">
        <div className="mb-4">
          <h2 id="finance-summary" className="text-base font-semibold">Ringkasan {data.range.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hanya Sales Order aktif dan transaksi pembayaran aktif yang dihitung.</p>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-foreground p-5 text-background">
            <dt className="flex items-center gap-2 text-sm text-background/75"><HandCoins aria-hidden="true" className="size-4" />Uang masuk</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.totals.moneyIn)}</dd>
            <p className="mt-2 text-xs text-background/75">{data.totals.transactionCount} transaksi aktif</p>
          </div>
          <div className="bg-warning-surface p-5 text-warning-surface-foreground">
            <dt className="flex items-center gap-2 text-sm text-warning-surface-foreground/75"><CircleDollarSign aria-hidden="true" className="size-4" />Sisa pembayaran</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.totals.outstandingAmount)}</dd>
            <p className="mt-2 text-xs text-warning-surface-foreground/75">{data.totals.outstandingOrderCount} order belum lunas</p>
          </div>
          <div className="bg-success-surface p-5 text-success-surface-foreground">
            <dt className="text-sm text-success-surface-foreground/75">Nilai order Deal</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.totals.dealOrderValue)}</dd>
            <p className="mt-2 text-xs text-success-surface-foreground/75">{data.totals.dealOrderCount} Sales Order aktif</p>
          </div>
          <div className="bg-card p-5 text-card-foreground">
            <dt className="text-sm text-muted-foreground">Status laporan</dt>
            <dd className="mt-2 text-base font-medium">Read-only</dd>
            <p className="mt-2 text-xs text-muted-foreground">Pencatatan tetap dilakukan dari detail Sales Order.</p>
          </div>
        </dl>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Transaksi uang masuk</CardTitle>
          <CardDescription>
            {data.totals.transactionCount > data.transactions.length
              ? `Menampilkan ${data.limits.transactions} transaksi terbaru dari rentang ini.`
              : "Semua transaksi aktif pada rentang ini."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasTransactions ? (
            <Table className="min-w-5xl">
              <TableCaption className="sr-only">Daftar transaksi uang masuk dari Sales Order aktif.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Referensi</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.paidAt, true)}</TableCell>
                    <TableCell className="font-mono">
                      <Link href={`/sales-orders/${item.salesOrderId}`} className="underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {item.salesOrderNo}
                      </Link>
                    </TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.transactionKind}</span>
                        <Badge variant="outline">{item.paymentKind}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>{item.reference ?? "-"}</TableCell>
                    <TableCell>{item.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ReceiptText aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Belum ada uang masuk</EmptyTitle>
                <EmptyDescription>Pilih rentang lain atau catat pembayaran dari detail Sales Order.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order dengan sisa pembayaran</CardTitle>
          <CardDescription>
            {data.totals.outstandingOrderCount > data.outstandingOrders.length
              ? `Menampilkan ${data.limits.outstandingOrders} order terbaru yang belum lunas.`
              : "Sales Order aktif yang masih memiliki kekurangan pembayaran."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasOutstandingOrders ? (
            <Table className="min-w-4xl">
              <TableCaption className="sr-only">Daftar Sales Order aktif yang belum lunas.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total order</TableHead>
                  <TableHead className="text-right">Sudah masuk</TableHead>
                  <TableHead className="text-right">Sisa pembayaran</TableHead>
                  <TableHead>Tanggal Deal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outstandingOrders.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">
                      <Link href={`/sales-orders/${item.salesOrderId}`} className="underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {item.salesOrderNo}
                      </Link>
                    </TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.total)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.paidAmount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.outstandingAmount)}</TableCell>
                    <TableCell>{formatDate(item.acceptedAt, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileSearch aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Tidak ada sisa pembayaran</EmptyTitle>
                <EmptyDescription>Semua Sales Order aktif sudah tercatat lunas.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function FinanceSkeleton() {
  return (
    <>
      <Card size="sm" aria-hidden="true">
        <CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-72 max-w-full" /></CardHeader>
        <CardContent><Skeleton className="h-9 w-full max-w-lg" /></CardContent>
      </Card>
      <section className="grid gap-px overflow-hidden rounded-xl border bg-border" aria-hidden="true">
        <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-none" />)}
        </div>
      </section>
      <Skeleton className="h-80 w-full" aria-hidden="true" />
      <Skeleton className="h-80 w-full" aria-hidden="true" />
    </>
  );
}

export default function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Keuangan"
        description="Pantau uang masuk dan sisa pembayaran dari order customer yang sudah Deal."
      />
      <Suspense fallback={<FinanceSkeleton />}>
        <FinanceOverview searchParams={searchParams} />
      </Suspense>
    </>
  );
}
