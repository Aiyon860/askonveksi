"use client";

import useSWR from "swr";
import { CalendarClock, CircleDollarSign, Factory, FileText, HandCoins, Percent, Receipt, Repeat2, TrendingUp, TriangleAlert, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";

import { fetcher } from "@/lib/fetcher";
import {
  DASH_CARD_CLASS,
  DASH_SALES_SPANS,
  DashAccentTile,
  DashRowIcon,
  DashSectionHeading,
  DashStageTile,
  DashStatTile,
} from "@/components/dashboard/dashboard-ui";
import { LazyBusinessTrendChart } from "@/components/dashboard/lazy-business-trend-chart";
import { InvoiceDetail } from "@/components/crm/invoice-detail";
import { PurchaseOrderDetail } from "@/components/crm/purchase-order-detail";
import { STAGE_ICON, STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
import { InvoiceStatusBadge, PurchaseOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/crm/format";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { InvoiceStatus, OpportunityStage, PurchaseOrderStatus } from "@prisma/client";

export type DashboardData = {
  canViewFinancialData: boolean;
  stageCounts: Partial<Record<OpportunityStage, number>>;
  totalLeadCount: number;
  dealCount: number;
  conversionRate: number;
  dealRevenue: string | null;
  businessKpis: {
    orderCount: number;
    averageOrderValue: string;
    newCustomerCount: number;
    repeatCustomerCount: number;
    repeatRate: number;
    grossMargin: number | null;
    costedOrderCount: number;
    activeProductionCount: number;
    overdueProductionCount: number;
  } | null;
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

  const pipelineTotal = PIPELINE_STAGES.reduce((total, stage) => total + (data.stageCounts[stage] ?? 0), 0);
  const shareOfPipeline = (count: number) => (pipelineTotal > 0 ? count / pipelineTotal : 0);

  return (
    <>
      {data.canViewFinancialData ? (
        <section aria-labelledby="sales-summary">
          <DashSectionHeading
            id="sales-summary"
            title="Ringkasan hasil sales"
            description="Omzet Deal bulan berjalan dan conversion rate seluruh waktu."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <DashAccentTile
              className={DASH_SALES_SPANS[0]}
              label="Omzet deal bulan ini"
              value={formatCurrency(data.dealRevenue)}
              icon={CircleDollarSign}
            />
            <DashStatTile
              className={DASH_SALES_SPANS[1]}
              label="Conversion rate"
              value={formatPercentage(data.conversionRate)}
              icon={Percent}
              tone="primary"
              ratio={data.conversionRate}
              meta={data.totalLeadCount > 0 ? `${data.dealCount} Deal dari ${data.totalLeadCount} lead` : "Belum ada lead untuk dihitung."}
            />
            <DashStatTile
              className={DASH_SALES_SPANS[2]}
              label="AOV"
              value={formatCurrency(data.businessKpis?.averageOrderValue)}
              icon={Wallet}
              meta={`${data.businessKpis?.orderCount ?? 0} order bulan ini`}
            />
            <DashStatTile
              className={DASH_SALES_SPANS[3]}
              label="Repeat rate"
              value={formatPercentage(data.businessKpis?.repeatRate ?? 0)}
              icon={Repeat2}
              tone="success"
              ratio={data.businessKpis?.repeatRate ?? 0}
              meta={`${data.businessKpis?.repeatCustomerCount ?? 0} customer repeat`}
            />
            <DashStatTile
              className={DASH_SALES_SPANS[4]}
              label="Gross margin"
              value={data.businessKpis?.grossMargin === null ? "-" : formatPercentage(data.businessKpis?.grossMargin ?? 0)}
              icon={TrendingUp}
              ratio={data.businessKpis?.grossMargin === null ? null : data.businessKpis?.grossMargin ?? 0}
              meta={data.businessKpis?.costedOrderCount ? `HPP lengkap pada ${data.businessKpis.costedOrderCount} order` : "HPP belum lengkap"}
            />
          </div>
        </section>
      ) : null}

      {data.canViewFinancialData && data.financeSummary ? (
        <section aria-labelledby="finance-summary">
          <Card className={DASH_CARD_CLASS}>
            <CardHeader>
              <CardTitle id="finance-summary" className="font-semibold">Ringkasan keuangan</CardTitle>
              <CardDescription>Uang masuk bulan berjalan dan sisa pembayaran dari Sales Order aktif.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/keuangan" />} nativeButton={false}>Buka keuangan</Button></CardAction>
            </CardHeader>
            {/* Nominal rupiah butuh lebar penuh sampai kartunya benar-benar lega. */}
            <CardContent className="grid gap-3 lg:grid-cols-2">
              <DashAccentTile
                label="Uang masuk bulan ini"
                value={formatCurrency(data.financeSummary.moneyInThisMonth)}
                meta={`${data.financeSummary.transactionCountThisMonth} transaksi aktif`}
                icon={HandCoins}
              />
              <DashStatTile
                panel="tinted"
                label="Sisa pembayaran aktif"
                value={formatCurrency(data.financeSummary.outstandingAmount)}
                meta={`${data.financeSummary.outstandingOrderCount} order belum lunas`}
                icon={CircleDollarSign}
                tone="warning"
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {data.canViewFinancialData && data.businessKpis ? (
        <section>
          {/* Dua kolom dulu agar label panjang tidak terpotong, tiga kolom saat sudah lega. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DashStatTile label="Customer baru bulan ini" value={data.businessKpis.newCustomerCount} icon={UsersRound} tone="info" />
            <DashStatTile label="Order sedang produksi" value={data.businessKpis.activeProductionCount} icon={Factory} tone="primary" />
            <DashStatTile
              label="Order produksi terlambat"
              value={data.businessKpis.overdueProductionCount}
              icon={TriangleAlert}
              tone="danger"
              /* Kartu ketiga menutup barisnya sendiri saat grid masih dua kolom. */
              className="sm:col-span-2 xl:col-span-1"
              /* Bidang status hanya menyala saat memang ada order yang terlambat. */
              panel={data.businessKpis.overdueProductionCount > 0 ? "tinted" : "card"}
            />
          </div>
        </section>
      ) : null}

      {data.canViewFinancialData ? <LazyBusinessTrendChart /> : null}

      <section aria-labelledby="latest-documents-title">
        <DashSectionHeading
          id="latest-documents-title"
          title="Dokumen terbaru"
          description="Aktivitas PO customer dan invoice yang baru dibuat, termasuk revisi yang sudah digantikan."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className={DASH_CARD_CLASS}>
            <CardHeader>
              <CardTitle className="font-semibold">Purchase order terbaru</CardTitle>
              <CardDescription>Lima PO terakhir berdasarkan tanggal dibuat.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/crm/purchase-orders" />} nativeButton={false}>Lihat semua PO</Button></CardAction>
            </CardHeader>
            <CardContent className="gap-0">
              {data.latestPurchaseOrders.length ? data.latestPurchaseOrders.map((item, index) => (
                <PurchaseOrderDetail
                  key={item.id}
                  id={item.id}
                  triggerVariant="preview"
                  triggerClassName={cn("-mx-3 rounded-xl px-3 hover:bg-muted", index > 0 && "border-t border-border")}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DashRowIcon icon={FileText} tone="primary" />
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{item.purchaseOrderNo}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{item.customerName}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.productName}</p>
                    </div>
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

          <Card className={DASH_CARD_CLASS}>
            <CardHeader>
              <CardTitle className="font-semibold">Invoice terbaru</CardTitle>
              <CardDescription>Lima invoice terakhir berdasarkan tanggal dibuat.</CardDescription>
              <CardAction><Button size="sm" variant="link" render={<Link href="/crm/invoices" />} nativeButton={false}>Lihat semua invoice</Button></CardAction>
            </CardHeader>
            <CardContent className="gap-0">
              {data.latestInvoices.length ? data.latestInvoices.map((item, index) => (
                <InvoiceDetail
                  key={item.id}
                  id={item.id}
                  triggerVariant="preview"
                  triggerClassName={cn("-mx-3 rounded-xl px-3 hover:bg-muted", index > 0 && "border-t border-border")}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DashRowIcon icon={Receipt} tone="info" />
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{item.invoiceNo}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{item.customerName}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">PO {item.purchaseOrderNo}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <InvoiceStatusBadge status={item.status} />
                    <div className="text-right text-xs leading-5">
                      <p className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(item.total)}</p>
                      <p className="mt-1 text-muted-foreground">Dibuat {formatDate(item.createdAt)}</p>
                      {item.dueAt ? <p className="mt-1 text-muted-foreground">Deadline pembayaran awal {formatDate(item.dueAt)}</p> : null}
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
        <DashSectionHeading
          id="pipeline-stage-title"
          title="Pipeline aktif"
          description="Jumlah opportunity pada setiap tahap kerja dan porsinya terhadap seluruh pipeline."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PIPELINE_STAGES.map((stage) => {
            const count = data.stageCounts[stage] ?? 0;
            const share = shareOfPipeline(count);
            return (
              <DashStageTile
                key={stage}
                icon={STAGE_ICON[stage]}
                label={STAGE_LABEL[stage]}
                value={count}
                share={share}
                meta={`${formatPercentage(share)} dari total`}
                surfaceClassName={STAGE_SURFACE_CLASS[stage]}
                inkClassName={STAGE_TEXT_CLASS[stage]}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="next-action-title">
        <Card className={DASH_CARD_CLASS}>
          <CardHeader>
            <CardTitle id="next-action-title" className="font-semibold">Next action terdekat</CardTitle>
            <CardDescription>Urutan kerja berdasarkan waktu yang paling awal.</CardDescription>
            <CardAction><Button size="sm" variant="link" render={<Link href="/crm/follow-up" />} nativeButton={false}>Lihat semua</Button></CardAction>
          </CardHeader>
          <CardContent>
            {data.urgentActions.length ? (
              <div className="flex flex-col divide-y">
                {data.urgentActions.map((item) => (
                  <article key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <DashRowIcon icon={CalendarClock} tone="warning" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/crm/peluang/${item.id}`} className="font-medium underline-offset-4 hover:underline">{item.nextAction}</Link>
                      <p className="mt-1 text-sm text-muted-foreground">{item.customer.name} · {item.title}</p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{formatDate(item.nextActionAt, true)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty className="min-h-48 border-0">
                <EmptyHeader>
                  <EmptyTitle>Belum ada next action</EmptyTitle>
                  <EmptyDescription>Jadwalkan tindakan berikutnya dari detail opportunity.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
