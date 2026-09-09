"use client";

import useSWR from "swr";
import { AlertTriangle, CalendarClock, CircleDollarSign, HandCoins, Percent } from "lucide-react";
import Link from "next/link";

import { fetcher } from "@/lib/fetcher";
import { InvoiceDetail } from "@/components/crm/invoice-detail";
import { PurchaseOrderDetail } from "@/components/crm/purchase-order-detail";
import { InvoiceStatusBadge, OpportunityStatusBadge, PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
import { LazyBusinessTrendChart } from "@/components/dashboard/lazy-business-trend-chart";
import { PIPELINE_STAGES } from "@/lib/crm/constants";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/crm/format";
import type { ReactNode } from "react";
import type { InvoiceStatus, OpportunityStage, PurchaseOrderStatus } from "@prisma/client";

export type DashboardData = {
  stageCounts: Partial<Record<OpportunityStage, number>>;
  totalLeadCount: number;
  dealCount: number;
  conversionRate: number;
  dealRevenue: string;
  overdue: number;
  dueToday: number;
  urgentActions: Array<{
    id: string;
    title: string;
    nextAction: string | null;
    nextActionAt: string | null;
    customer: { name: string };
  }>;
  latestPurchaseOrders: Array<{
    id: string;
    opportunityId: string;
    purchaseOrderNo: string;
    customerName: string;
    productName: string;
    status: PurchaseOrderStatus;
    createdAt: string;
    deadline: string | null;
  }>;
  latestInvoices: Array<{
    id: string;
    opportunityId: string;
    invoiceNo: string;
    purchaseOrderNo: string;
    customerName: string;
    status: InvoiceStatus;
    total: string;
    createdAt: string;
    dueAt: string | null;
  }>;
  financeSummary: {
    moneyInThisMonth: string;
    transactionCountThisMonth: number;
    outstandingAmount: string;
    outstandingOrderCount: number;
  } | null;
};

function DashboardFallback({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DashboardContentClient({ initialData }: { initialData: DashboardData }) {
  const { data } = useSWR<DashboardData>("/api/crm/dashboard", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
    dedupingInterval: 5000,
  });

  if (!data) return <DashboardFallback><div /></DashboardFallback>;

  return (
    <>
      <section aria-labelledby="sales-summary" className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.45fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="py-5">
            <CardTitle id="sales-summary">Ringkasan hasil sales</CardTitle>
            <CardDescription>Omzet Deal bulan berjalan dan conversion rate seluruh waktu.</CardDescription>
          </CardHeader>
          <MetricGroup className="rounded-none border-x-0 border-b-0 sm:grid-cols-2">
            <MetricItem label="Omzet deal bulan ini" value={formatCurrency(data.dealRevenue)} icon={CircleDollarSign} tone="success" emphasis />
            <MetricItem
              label="Conversion rate"
              value={formatPercentage(data.conversionRate)}
              icon={Percent}
              emphasis
              meta={data.totalLeadCount > 0 ? `${data.dealCount} Deal dari ${data.totalLeadCount} lead` : "Belum ada lead untuk dihitung."}
            />
          </MetricGroup>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="py-5">
            <CardTitle>Follow-up mendesak</CardTitle>
            <CardDescription>Next action sampai akhir hari ini.</CardDescription>
          </CardHeader>
          <MetricGroup className="grid-cols-2 rounded-none border-x-0 border-b-0">
            <MetricItem label="Terlambat" value={data.overdue} icon={AlertTriangle} tone="danger" emphasis />
            <MetricItem label="Hari ini" value={data.dueToday} icon={CalendarClock} tone="warning" emphasis />
          </MetricGroup>
        </Card>
      </section>

      {data.financeSummary ? (
        <section aria-labelledby="finance-summary">
          <Card className="gap-0 py-0">
            <CardHeader className="py-5">
              <CardTitle id="finance-summary">Ringkasan keuangan</CardTitle>
              <CardDescription>Uang masuk bulan berjalan dan sisa pembayaran dari Sales Order aktif.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/keuangan" />} nativeButton={false}>Buka keuangan</Button></CardAction>
            </CardHeader>
            <MetricGroup className="rounded-none border-x-0 border-b-0 sm:grid-cols-2">
              <MetricItem label="Uang masuk bulan ini" value={formatCurrency(data.financeSummary.moneyInThisMonth)} meta={`${data.financeSummary.transactionCountThisMonth} transaksi aktif`} icon={HandCoins} tone="success" emphasis />
              <MetricItem label="Sisa pembayaran aktif" value={formatCurrency(data.financeSummary.outstandingAmount)} meta={`${data.financeSummary.outstandingOrderCount} order belum lunas`} icon={CircleDollarSign} tone="warning" emphasis />
            </MetricGroup>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="latest-documents-title">
        <div className="mb-4">
          <h2 id="latest-documents-title" className="text-base font-semibold">Dokumen terbaru</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aktivitas PO customer dan invoice yang baru dibuat, termasuk revisi yang sudah digantikan.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Purchase order terbaru</CardTitle>
              <CardDescription>Lima PO terakhir berdasarkan tanggal dibuat.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/crm/purchase-orders" />} nativeButton={false}>Lihat semua PO</Button></CardAction>
            </CardHeader>
            <CardContent className="gap-0">
              {data.latestPurchaseOrders.length ? data.latestPurchaseOrders.map((item, index) => (
                <PurchaseOrderDetail
                  key={item.id}
                  id={item.id}
                  triggerVariant="preview"
                  triggerClassName={index > 0 ? "border-t" : undefined}
                >
                  <div className="min-w-0">
                    <p className="font-mono font-medium">{item.purchaseOrderNo}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.customerName}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.productName}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <PurchaseOrderStatusBadge status={item.status} />
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Dibuat {formatDate(item.createdAt)}</p>
                      {item.deadline ? <p className="mt-1">Deadline produksi {formatDate(item.deadline)}</p> : null}
                    </div>
                  </div>
                </PurchaseOrderDetail>
              )) : (
                <Empty className="min-h-48 border-0 p-6">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada purchase order</EmptyTitle>
                    <EmptyDescription>PO yang dibuat dari opportunity akan muncul di sini.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice terbaru</CardTitle>
              <CardDescription>Lima invoice terakhir berdasarkan tanggal dibuat.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/crm/invoices" />} nativeButton={false}>Lihat semua invoice</Button></CardAction>
            </CardHeader>
            <CardContent className="gap-0">
              {data.latestInvoices.length ? data.latestInvoices.map((item, index) => (
                <InvoiceDetail
                  key={item.id}
                  id={item.id}
                  triggerVariant="preview"
                  triggerClassName={index > 0 ? "border-t" : undefined}
                >
                  <div className="min-w-0">
                    <p className="font-mono font-medium">{item.invoiceNo}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.customerName}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">PO {item.purchaseOrderNo}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <InvoiceStatusBadge status={item.status} />
                    <div className="text-right text-xs">
                      <p className="font-medium tabular-nums text-foreground">{formatCurrency(item.total)}</p>
                      <p className="mt-1 text-muted-foreground">Dibuat {formatDate(item.createdAt)}</p>
                      {item.dueAt ? <p className="mt-1 text-muted-foreground">Jatuh tempo {formatDate(item.dueAt)}</p> : null}
                    </div>
                  </div>
                </InvoiceDetail>
              )) : (
                <Empty className="min-h-48 border-0 p-6">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada invoice</EmptyTitle>
                    <EmptyDescription>Invoice yang dibuat dari PO akan muncul di sini.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="pipeline-stage-title">
        <div className="mb-4"><h2 id="pipeline-stage-title" className="text-base font-semibold">Pipeline aktif</h2><p className="mt-1 text-sm text-muted-foreground">Jumlah opportunity pada setiap tahap kerja.</p></div>
        <MetricGroup className="grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {PIPELINE_STAGES.map((stage) => <MetricItem key={stage} label={<OpportunityStatusBadge stage={stage} />} value={data.stageCounts[stage] ?? 0} />)}
        </MetricGroup>
      </section>

      <LazyBusinessTrendChart />

      <section aria-labelledby="next-action-title">
        <Card>
          <CardHeader><CardTitle id="next-action-title">Next action terdekat</CardTitle><CardDescription>Urutan kerja berdasarkan waktu yang paling awal.</CardDescription><CardAction><Button size="sm" variant="link" render={<Link href="/crm/follow-up" />} nativeButton={false}>Lihat semua</Button></CardAction></CardHeader>
          <CardContent>
            {data.urgentActions.length ? <div className="flex flex-col divide-y">{data.urgentActions.map((item) => <article key={item.id} className="py-3 first:pt-0 last:pb-0"><Link href={`/crm/peluang/${item.id}`} className="font-medium underline-offset-4 hover:underline">{item.nextAction}</Link><p className="mt-1 text-sm text-muted-foreground">{item.customer.name} · {item.title}</p><p className="mt-1 font-mono text-xs">{formatDate(item.nextActionAt, true)}</p></article>)}</div> : <Empty className="min-h-48 border-0"><EmptyHeader><EmptyTitle>Belum ada next action</EmptyTitle><EmptyDescription>Jadwalkan tindakan berikutnya dari detail opportunity.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
