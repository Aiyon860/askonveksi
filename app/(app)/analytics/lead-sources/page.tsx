import { ChartNoAxesCombined } from "lucide-react";

import { LeadSourceRevenueChart } from "@/components/analytics/lead-source-revenue-chart";
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
import { getLeadSourceRevenueData } from "@/lib/crm/data";
import { formatCurrency } from "@/lib/crm/format";

const PERIOD_LABEL = {
  month: "Bulan berjalan",
  year: "Tahun berjalan",
  all: "Seluruh waktu",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadSourceRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const params = await searchParams;
  const period = parseAnalyticsPeriod(first(params.period));
  const data = await getLeadSourceRevenueData(period);
  const hasActivity = data.totals.leadCount > 0 || data.totals.dealCount > 0;
  const hasRevenue = Number(data.totals.revenue) > 0;

  return (
    <>
      <PageHeader
        title="Sumber lead dan omzet"
        description="Bandingkan jumlah lead, deal, dan omzet nyata untuk mengetahui kanal yang menghasilkan penjualan."
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Periode laporan</CardTitle>
          <CardDescription>Lead mengikuti tanggal masuk. Deal dan omzet mengikuti tanggal Sales Order diterima.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get">
            <FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end">
              <Field className="sm:max-w-xs">
                <FieldLabel htmlFor="period">Rentang waktu</FieldLabel>
                <NativeSelect id="period" name="period" defaultValue={period} className="w-full">
                  {ANALYTICS_PERIODS.map((value) => (
                    <NativeSelectOption key={value} value={value}>{PERIOD_LABEL[value]}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit" variant="outline">Terapkan periode</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="lead-source-summary">
        <div className="mb-4">
          <h2 id="lead-source-summary" className="text-base font-semibold">Ringkasan {data.periodLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hanya Sales Order aktif yang masuk ke perhitungan deal dan omzet.</p>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          <div className="bg-info-surface p-5 text-info-surface-foreground">
            <dt className="text-sm text-info-surface-foreground/75">Lead</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.leadCount}</dd>
          </div>
          <div className="bg-highlight/10 p-5 text-highlight">
            <dt className="text-sm text-highlight/80">Deal</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.totals.dealCount}</dd>
          </div>
          <div className="bg-success-surface p-5 text-success-surface-foreground">
            <dt className="text-sm text-success-surface-foreground/75">Omzet</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.totals.revenue)}</dd>
          </div>
        </dl>
      </section>

      {!hasActivity ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ChartNoAxesCombined aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>Belum ada aktivitas pada periode ini</EmptyTitle>
            <EmptyDescription>Pilih periode lain atau pastikan sumber lead sudah diisi pada opportunity baru.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Perbandingan omzet</CardTitle>
              <CardDescription>Sumber diurutkan dari omzet Sales Order aktif terbesar.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasRevenue ? (
                <LeadSourceRevenueChart rows={data.rows} />
              ) : (
                <Empty className="min-h-64 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ChartNoAxesCombined aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>Belum ada omzet</EmptyTitle>
                    <EmptyDescription>Lead sudah tercatat, tetapi belum ada Sales Order aktif yang diterima pada periode ini.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rincian per sumber</CardTitle>
              <CardDescription>Gunakan tabel ini sebagai sumber angka utama untuk evaluasi kanal pemasaran.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption className="sr-only">Lead, deal, dan omzet untuk setiap sumber lead pada {data.periodLabel}.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sumber</TableHead>
                    <TableHead className="text-right">Lead</TableHead>
                    <TableHead className="text-right">Deal</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.sourceId ?? "unattributed"}>
                      <TableCell className="font-medium">
                        {row.sourceId ? row.sourceName : <Badge variant="warning">Belum ditentukan</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{row.leadCount}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{row.dealCount}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{data.totals.leadCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{data.totals.dealCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(data.totals.revenue)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
