import { ChartNoAxesCombined } from "lucide-react";
import Link from "next/link";

import { LazyLeadSourceRevenueChart } from "@/components/analytics/lazy-lead-source-revenue-chart";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
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
import { getLeadSourceRevenueData } from "@/lib/crm/data";
import { formatCurrency } from "@/lib/crm/format";

export const revalidate = 60;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadSourceRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  const params = await searchParams;
  const data = await getLeadSourceRevenueData(params);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const rangeParams = new URLSearchParams();
  if (rawFrom) rangeParams.set("from", rawFrom);
  if (rawTo) rangeParams.set("to", rawTo);
  const rangeHref = `/analytics/lead-sources${rangeParams.toString() ? `?${rangeParams.toString()}` : ""}`;
  const allParams = new URLSearchParams(rangeParams);
  allParams.set("mode", "all");
  const allHref = `/analytics/lead-sources?${allParams.toString()}`;
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
          <CardTitle>{data.mode === "all" ? "Rekapan semua order" : "Rentang laporan"}</CardTitle>
          <CardDescription>
            {data.mode === "all"
              ? "Seluruh lead dan Sales Order aktif ditampilkan tanpa batas tanggal."
              : "Lead mengikuti tanggal masuk. Deal dan omzet mengikuti tanggal Sales Order diterima."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.mode === "all" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" render={<Link href={rangeHref} />} nativeButton={false}>Gunakan rentang tanggal</Button>
              <p className="text-sm text-muted-foreground">Klik tombol ini untuk kembali ke filter tanggal jika ingin memeriksa periode tertentu.</p>
            </div>
          ) : (
            <form method="get">
              <input type="hidden" name="mode" value="range" />
              <FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end">
                <Field className="sm:max-w-48">
                  <FieldLabel htmlFor="from">Dari tanggal</FieldLabel>
                  <Input id="from" name="from" type="date" defaultValue={data.range.from} />
                </Field>
                <Field className="sm:max-w-48">
                  <FieldLabel htmlFor="to">Sampai tanggal</FieldLabel>
                  <Input id="to" name="to" type="date" defaultValue={data.range.to} />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="outline">Terapkan rentang</Button>
                  <Button variant="secondary" render={<Link href={allHref} />} nativeButton={false}>Rekapan semua order</Button>
                </div>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="lead-source-summary">
        <div className="mb-4">
          <h2 id="lead-source-summary" className="text-base font-semibold">Ringkasan {data.periodLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hanya Sales Order aktif yang masuk ke perhitungan deal dan omzet.</p>
        </div>
        <MetricGroup className="sm:grid-cols-3">
          <MetricItem label="Lead" value={data.totals.leadCount} />
          <MetricItem label="Deal" value={data.totals.dealCount} tone="success" />
          <MetricItem label="Omzet" value={formatCurrency(data.totals.revenue)} tone="primary" emphasis />
        </MetricGroup>
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
                <LazyLeadSourceRevenueChart rows={data.rows} />
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
