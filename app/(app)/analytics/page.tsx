import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercentage } from "@/lib/crm/format";
import { getAnalyticsOverviewData } from "@/lib/crm/data";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[]; from?: string | string[]; to?: string | string[] }> }) {
  const params = await searchParams;
  const data = await getAnalyticsOverviewData(params);
  const rangeParams = new URLSearchParams();
  const from = first(params.from);
  const to = first(params.to);
  if (from) rangeParams.set("from", from);
  if (to) rangeParams.set("to", to);
  const allParams = new URLSearchParams(rangeParams);
  allParams.set("mode", "all");
  const hasData = data.funnel.some((item) => item.count > 0);

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Analytics penjualan" description="Gunakan ringkasan ini untuk menemukan titik hambat closing, produk, customer, PIC, dan tindak lanjut." />

    <Card size="sm">
      <CardHeader><CardTitle>Rentang laporan</CardTitle><CardDescription>Milestone, order, dan aktivitas mengikuti periode yang dipilih.</CardDescription></CardHeader>
      <CardContent>
        {data.mode === "all" ? <div className="flex flex-wrap items-center gap-3"><Button variant="outline" render={<Link href={`/analytics${rangeParams.size ? `?${rangeParams}` : ""}`} />} nativeButton={false}>Gunakan rentang tanggal</Button><p className="text-sm text-muted-foreground">Menampilkan seluruh data yang tercatat.</p></div> : <form method="get"><input type="hidden" name="mode" value="range" /><FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end"><Field className="sm:max-w-48"><FieldLabel htmlFor="from">Dari tanggal</FieldLabel><Input id="from" name="from" type="date" defaultValue={data.range.from} /></Field><Field className="sm:max-w-48"><FieldLabel htmlFor="to">Sampai tanggal</FieldLabel><Input id="to" name="to" type="date" defaultValue={data.range.to} /></Field><div className="flex flex-wrap gap-2"><Button type="submit" variant="outline">Terapkan</Button><Button variant="secondary" render={<Link href={`/analytics?${allParams}`} />} nativeButton={false}>Semua data</Button></div></FieldGroup></form>}
      </CardContent>
    </Card>

    {!hasData ? <Empty className="min-h-80"><EmptyHeader><EmptyTitle>Belum ada aktivitas pada periode ini</EmptyTitle><EmptyDescription>Pilih rentang lain atau mulai catat lead, aktivitas, dan Sales Order.</EmptyDescription></EmptyHeader></Empty> : <>
      <section aria-labelledby="funnel-title"><div className="mb-4"><h2 id="funnel-title" className="text-base font-semibold">Sales funnel {data.periodLabel}</h2><p className="mt-1 text-sm text-muted-foreground">Milestone yang tercatat, bukan cohort historis.</p></div><MetricGroup className="grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{data.funnel.map((item) => <MetricItem key={item.label} label={item.label} value={item.count} meta={item.label === "Lead" ? undefined : formatPercentage(item.conversion)} />)}</MetricGroup></section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Produk</CardTitle><CardDescription>Omzet, kuantitas, dan profit hanya saat HPP order lengkap.</CardDescription></CardHeader><CardContent>{data.productRows.length ? <Table><TableCaption className="sr-only">Produk teratas pada {data.periodLabel}.</TableCaption><TableHeader><TableRow><TableHead>Produk</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Omzet</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader><TableBody>{data.productRows.map((row) => { const complete = row.costedOrderCount === row.orderCount; const margin = complete && Number(row.revenue) ? (Number(row.revenue) - Number(row.hpp)) / Number(row.revenue) : null; return <TableRow key={row.productName}><TableCell className="font-medium">{row.productName}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.quantity}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.revenue)}</TableCell><TableCell className="text-right font-mono tabular-nums">{margin === null ? "-" : formatPercentage(margin)}</TableCell></TableRow>; })}</TableBody></Table> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada produk</EmptyTitle><EmptyDescription>Produk akan muncul setelah Sales Order aktif tercatat.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Customer</CardTitle><CardDescription>Customer diurutkan dari jumlah Sales Order aktif.</CardDescription></CardHeader><CardContent>{data.customerRows.length ? <Table><TableCaption className="sr-only">Customer teratas pada {data.periodLabel}.</TableCaption><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Order</TableHead><TableHead className="text-right">Omzet</TableHead></TableRow></TableHeader><TableBody>{data.customerRows.map((row) => <TableRow key={row.customerName}><TableCell className="font-medium">{row.customerName}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.orderCount}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.revenue)}</TableCell></TableRow>)}</TableBody></Table> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada customer dengan order</EmptyTitle><EmptyDescription>Customer akan muncul setelah Sales Order aktif tercatat.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <Card><CardHeader><CardTitle>Performa PIC</CardTitle><CardDescription>Leads, deal, dan omzet berdasarkan PIC yang ditugaskan.</CardDescription></CardHeader><CardContent>{data.picRows.length ? <Table><TableCaption className="sr-only">Performa PIC pada {data.periodLabel}.</TableCaption><TableHeader><TableRow><TableHead>PIC</TableHead><TableHead className="text-right">Lead</TableHead><TableHead className="text-right">Deal</TableHead><TableHead className="text-right">Omzet</TableHead></TableRow></TableHeader><TableBody>{data.picRows.map((row) => <TableRow key={row.picName}><TableCell className="font-medium">{row.picName}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.leadCount}</TableCell><TableCell className="text-right font-mono tabular-nums">{row.dealCount}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.revenue)}</TableCell></TableRow>)}</TableBody></Table> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada PIC aktif</EmptyTitle><EmptyDescription>Assign PIC pada peluang untuk melihat ringkasan performa.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Follow-up perlu perhatian</CardTitle><CardDescription>Gunakan daftar Follow-up untuk menyelesaikan tindakan yang tertunda.</CardDescription></CardHeader><CardContent><MetricGroup className="grid-cols-2"><MetricItem label="Terlambat" value={data.followUp.overdue} tone="danger" /><MetricItem label="Hari ini" value={data.followUp.dueToday} tone="warning" /></MetricGroup><Button className="mt-3 self-start" variant="outline" render={<Link href="/crm/follow-up" />} nativeButton={false}>Buka Follow-up</Button></CardContent></Card>
      </section>
    </>}
  </div>;
}
