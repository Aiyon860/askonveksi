import Link from "next/link";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { getFinanceReport } from "@/lib/finance/report";

type SearchParams = Promise<{ from?: string | string[]; to?: string | string[] }>;

export default async function FinanceReportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseOptionalFinanceDateRange(params.from, params.to);
  const report = await getFinanceReport({ from: range.start, to: range.end });
  const exportParams = new URLSearchParams(Object.entries({ from: range.from || undefined, to: range.to || undefined }).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Laporan" description="Rekap pemasukan dan pengeluaran berdasarkan tanggal." action={<Button variant="outline" render={<a href={`/api/keuangan/laporan/export?${exportParams}`} />} nativeButton={false}><Download data-icon="inline-start" aria-hidden="true" />Export Excel</Button>} />
    <section className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle>Total Pemasukan</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{formatCurrency(report.allIncome)}</p></CardContent></Card><Card><CardHeader><CardTitle>Total Pengeluaran</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{formatCurrency(report.allExpense)}</p></CardContent></Card></section>
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Detail Laporan">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between"><h2 className="text-base font-medium">Detail Laporan</h2><form action="/keuangan/laporan" className="flex flex-wrap items-end gap-2 lg:justify-end"><Field className="w-full sm:w-40"><FieldLabel htmlFor="report-from">Dari tanggal</FieldLabel><Input id="report-from" name="from" type="date" defaultValue={range.from} /></Field><Field className="w-full sm:w-40"><FieldLabel htmlFor="report-to">Sampai tanggal</FieldLabel><Input id="report-to" name="to" type="date" defaultValue={range.to} /></Field><Button type="submit" variant="outline">Terapkan</Button><Button variant="secondary" render={<Link href="/keuangan/laporan" />} nativeButton={false}>Reset</Button></form></div>
      {report.groups.length ? <div className="flex min-h-112 flex-1 flex-col"><Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto px-4 py-3"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead>Tanggal</TableHead><TableHead>Pemasukan</TableHead><TableHead>Pengeluaran</TableHead></TableRow></TableHeader><TableBody>{report.groups.flatMap((group, groupIndex) => Array.from({ length: Math.max(group.income.length, group.expenses.length) }, (_, index) => <TableRow key={`${group.date}-${index}`} className={groupIndex % 2 ? "bg-muted/60 hover:bg-muted/70" : "bg-card hover:bg-muted/50"}>{index === 0 ? <TableCell rowSpan={Math.max(group.income.length, group.expenses.length)} className="align-middle">{formatDate(`${group.date}T00:00:00.000Z`)}</TableCell> : null}<TableCell>{group.income[index] ? <Link className="flex items-center justify-between gap-6 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/keuangan/pemasukan?q=${encodeURIComponent(group.income[index].query)}&from=${group.date}&to=${group.date}`}><span className="truncate">{group.income[index].label}</span><span className="shrink-0 font-mono tabular-nums">{formatCurrency(group.income[index].amount)}</span></Link> : <span className="text-muted-foreground">-</span>}</TableCell><TableCell>{group.expenses[index] ? <Link className="flex items-center justify-between gap-6 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/keuangan/pengeluaran?q=${encodeURIComponent(group.expenses[index].label)}&from=${group.date}&to=${group.date}`}><span className="truncate">{group.expenses[index].label}</span><span className="shrink-0 font-mono tabular-nums">{formatCurrency(group.expenses[index].amount)}</span></Link> : <span className="text-muted-foreground">-</span>}</TableCell></TableRow>))}</TableBody></Table></div> : <Empty className="p-12"><EmptyHeader><EmptyMedia variant="icon"><Download aria-hidden="true" /></EmptyMedia><EmptyTitle>Belum ada data laporan</EmptyTitle><EmptyDescription>Ubah filter tanggal atau tunggu transaksi tercatat.</EmptyDescription></EmptyHeader></Empty>}
    </section>
    <section className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle>Total Pendapatan</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{formatCurrency(report.totalIncome)}</p></CardContent></Card><Card><CardHeader><CardTitle>Total Pengeluaran</CardTitle></CardHeader><CardContent><p className="font-mono text-2xl font-semibold tabular-nums">{formatCurrency(report.totalExpense)}</p></CardContent></Card></section>
  </div>;
}
