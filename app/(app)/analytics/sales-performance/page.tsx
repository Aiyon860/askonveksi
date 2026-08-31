/*
THESIS: Evaluasi hasil per sales, bukan parade kartu statistik.
OWN-WORLD: Ruang Kendali Konveksi dengan permukaan tonal dan satu aksen revenue.
STORY: Owner memilih periode, membaca hasil utama, lalu memeriksa rincian tiap sales.
FIRST VIEWPORT: Filter ringkas diikuti strip metrik dengan omzet sebagai nilai terkuat.
FORM: Laporan operasional code-led, ENERGY 1 / RHYTHM 2 / MOTION 1.
*/
import { ChartNoAxesCombined, UserRoundX } from "lucide-react";

import { SalesPerformanceRevenueChart } from "@/components/analytics/sales-performance-revenue-chart";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ANALYTICS_PERIODS,
  parseAnalyticsPeriod,
} from "@/lib/analytics/report-period";
import { getSalesPerformanceData } from "@/lib/crm/data";
import { formatCurrency } from "@/lib/crm/format";

const PERIOD_LABEL = {
  month: "Bulan berjalan",
  year: "Tahun berjalan",
  all: "Seluruh waktu",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const params = await searchParams;
  const period = parseAnalyticsPeriod(first(params.period));
  const data = await getSalesPerformanceData(period);
  const hasActivity =
    data.totals.leadCount > 0 ||
    data.totals.followUpCount > 0 ||
    data.totals.quotationCount > 0 ||
    data.totals.dealCount > 0 ||
    Number(data.totals.revenue) > 0;
  const hasRevenue = Number(data.totals.revenue) > 0;

  return (
    <>
      <PageHeader
        title="Performa sales"
        description="Bandingkan aktivitas terukur dan omzet setiap PIC untuk mengevaluasi hasil kerja pada periode yang sama."
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Periode laporan</CardTitle>
          <CardDescription>
            Lead mengikuti tanggal masuk, follow-up mengikuti waktu pencatatan, quotation mengikuti tanggal terbit, serta deal dan omzet mengikuti tanggal Sales Order diterima.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get">
            <FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end">
              <Field className="sm:max-w-xs">
                <FieldLabel htmlFor="period">Rentang waktu</FieldLabel>
                <NativeSelect id="period" name="period" defaultValue={period} className="w-full">
                  {ANALYTICS_PERIODS.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {PERIOD_LABEL[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit" variant="outline">Terapkan periode</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="sales-performance-summary">
        <div className="mb-4">
          <h2 id="sales-performance-summary" className="text-base font-semibold">
            Ringkasan {data.periodLabel}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua hasil mengikuti PIC opportunity saat ini. Hanya Sales Order aktif yang dihitung sebagai deal dan omzet.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(14rem,1.35fr)]">
          <div className="bg-info-surface p-5 text-info-surface-foreground">
            <dt className="text-sm opacity-75">Lead</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.leadCount}</dd>
          </div>
          <div className="bg-warning-surface p-5 text-warning-surface-foreground">
            <dt className="text-sm opacity-75">Follow-up</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.followUpCount}</dd>
          </div>
          <div className="bg-highlight-surface p-5 text-highlight-surface-foreground">
            <dt className="text-sm opacity-75">Quotation</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.quotationCount}</dd>
          </div>
          <div className="bg-success-surface p-5 text-success-surface-foreground">
            <dt className="text-sm opacity-75">Deal</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.dealCount}</dd>
          </div>
          <div className="col-span-2 bg-foreground p-5 text-background lg:col-span-1">
            <dt className="text-sm text-background/75">Omzet</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.totals.revenue)}</dd>
          </div>
        </dl>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Perbandingan omzet</CardTitle>
          <CardDescription>Sales diurutkan berdasarkan omzet Sales Order aktif terbesar.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasRevenue ? (
            <SalesPerformanceRevenueChart rows={data.rows} />
          ) : (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ChartNoAxesCombined aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>{hasActivity ? "Belum ada omzet" : "Belum ada aktivitas"}</EmptyTitle>
                <EmptyDescription>
                  {hasActivity
                    ? "Aktivitas sales sudah tercatat, tetapi belum ada Sales Order aktif yang diterima pada periode ini."
                    : "Pilih periode lain atau mulai catat aktivitas pada opportunity yang sudah memiliki PIC."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian per sales</CardTitle>
          <CardDescription>
            Follow-up menghitung setiap hasil yang dicatat. Quotation dan deal menghitung opportunity unik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.rows.length ? (
            <Table>
              <TableCaption className="sr-only">
                Lead, follow-up, quotation, deal, dan omzet setiap sales pada {data.periodLabel}.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales</TableHead>
                  <TableHead className="text-right">Lead</TableHead>
                  <TableHead className="text-right">Follow-up</TableHead>
                  <TableHead className="text-right">Quotation</TableHead>
                  <TableHead className="text-right">Deal</TableHead>
                  <TableHead className="text-right">Omzet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.salesId ?? "unassigned"}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {row.salesId ? <span>{row.salesName}</span> : <Badge variant="warning">Belum ada PIC</Badge>}
                        {row.salesId && !row.isActive ? <Badge variant="outline">Nonaktif</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.leadCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.followUpCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.quotationCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.dealCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{data.totals.leadCount}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{data.totals.followUpCount}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{data.totals.quotationCount}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{data.totals.dealCount}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(data.totals.revenue)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><UserRoundX aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Belum ada akun sales</EmptyTitle>
                <EmptyDescription>Tambahkan pengguna dengan role Sales agar performanya dapat dibandingkan.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
  );
}
