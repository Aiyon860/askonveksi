import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleDollarSign, Target } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { getSalesDashboardData } from "@/lib/crm/data";
import { formatCurrency, formatDate } from "@/lib/crm/format";

export default async function DashboardPage() {
  const data = await getSalesDashboardData();

  return (
    <>
      <PageHeader title="Dashboard sales" description="Ringkasan CRM yang perlu ditindaklanjuti hari ini." action={<Button render={<Link href="/crm/follow-up" />} nativeButton={false}>Buka Follow-up</Button>} />

      <section aria-labelledby="sales-summary" className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle id="sales-summary">Nilai pipeline</CardTitle>
            <CardDescription>Potensi opportunity terbuka dan omzet Sales Order aktif bulan berjalan.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
              <div className="bg-card p-5">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Target aria-hidden="true" className="size-4" />Potensi omzet</dt>
                <dd className="mt-3 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.potentialValue)}</dd>
              </div>
              <div className="bg-card p-5">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign aria-hidden="true" className="size-4" />Omzet deal bulan ini</dt>
                <dd className="mt-3 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(data.dealRevenue)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-up mendesak</CardTitle>
            <CardDescription>Next action sampai akhir hari ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle aria-hidden="true" className="size-4" />Terlambat</dt><dd className="mt-2 font-mono text-3xl font-semibold tabular-nums text-destructive">{data.overdue}</dd></div>
              <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock aria-hidden="true" className="size-4" />Hari ini</dt><dd className="mt-2 font-mono text-3xl font-semibold tabular-nums">{data.dueToday}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="pipeline-stage-title">
        <div className="mb-4"><h2 id="pipeline-stage-title" className="text-base font-semibold">Pipeline aktif</h2><p className="mt-1 text-sm text-muted-foreground">Jumlah opportunity pada setiap tahap kerja.</p></div>
        <dl className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 xl:grid-cols-8 xl:grid-flow-row xl:overflow-visible">
          {PIPELINE_STAGES.map((stage) => <div key={stage} className="rounded-lg border bg-card p-4"><dt className="text-xs text-muted-foreground">{STAGE_LABEL[stage]}</dt><dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data.stageCounts[stage] ?? 0}</dd></div>)}
        </dl>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Hot lead</CardTitle><CardDescription>Opportunity terbuka dengan skor minimal 80.</CardDescription><CardAction><Button size="sm" variant="link" render={<Link href="/crm" />} nativeButton={false}>Lihat pipeline</Button></CardAction></CardHeader>
          <CardContent>
            {data.hotLeads.length ? <div className="flex flex-col divide-y">{data.hotLeads.map((item) => <article key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><Link href={`/crm/peluang/${item.id}`} className="font-medium underline-offset-4 hover:underline">{item.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{item.customer.name} · {item.opportunityNo}</p></div><div className="shrink-0 text-right"><Badge variant="outline">HOT · {item.leadScore}</Badge><p className="mt-1 font-mono text-xs">{formatCurrency(item.estimatedValue)}</p></div></article>)}</div> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada hot lead</EmptyTitle><EmptyDescription>Lead dengan skor 80 atau lebih akan muncul di sini.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next action terdekat</CardTitle><CardDescription>Urutan kerja berdasarkan waktu yang paling awal.</CardDescription><CardAction><Button size="sm" variant="link" render={<Link href="/crm/follow-up" />} nativeButton={false}>Lihat semua</Button></CardAction></CardHeader>
          <CardContent>
            {data.urgentActions.length ? <div className="flex flex-col divide-y">{data.urgentActions.map((item) => <article key={item.id} className="py-3 first:pt-0 last:pb-0"><Link href={`/crm/peluang/${item.id}`} className="font-medium underline-offset-4 hover:underline">{item.nextAction}</Link><p className="mt-1 text-sm text-muted-foreground">{item.customer.name} · {item.title}</p><p className="mt-1 font-mono text-xs">{formatDate(item.nextActionAt, true)}</p></article>)}</div> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada next action</EmptyTitle><EmptyDescription>Jadwalkan tindakan berikutnya dari detail opportunity.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
