"use client";

import Link from "next/link";
import { useState } from "react";

import { customerDetailAction } from "@/app/actions/crm-details";
import { DocumentDetailTrigger } from "@/components/crm/document-detail-trigger";
import { CustomerActivityBadge, OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OPEN_STAGES } from "@/lib/crm/constants";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { activityStatusFromSchedule } from "@/lib/crm/reminder-types";

type Detail = Awaited<ReturnType<typeof customerDetailAction>>;

export function CustomerDetail({
  id,
  children,
  triggerClassName,
  triggerVariant,
}: {
  id: string;
  children: React.ReactNode;
  triggerClassName?: string;
  triggerVariant?: "preview" | "table-row";
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState(false);

  async function showDetail() {
    setOpen(true);
    if (detail) return;
    try {
      setDetail(await customerDetailAction(id));
    } catch {
      setError(true);
    }
  }

  const hasOpenOpportunity = detail?.opportunities.some((opportunity) => OPEN_STAGES.includes(opportunity.stage)) ?? false;
  const activityStatus = detail ? activityStatusFromSchedule(detail.reminders, new Date(), hasOpenOpportunity) : null;
  const salesOrders = detail?.opportunities
    .flatMap((opportunity) => opportunity.salesOrders.map((order) => ({ ...order, opportunity })))
    .sort((first, second) => second.acceptedAt.getTime() - first.acceptedAt.getTime())
    .slice(0, 5) ?? [];

  return (
    <>
      <DocumentDetailTrigger className={triggerClassName} onActivate={() => void showDetail()} variant={triggerVariant}>
        {children}
      </DocumentDetailTrigger>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail customer</DialogTitle>
            <DialogDescription>Profil singkat, kontak, peluang, dan order terbaru customer.</DialogDescription>
          </DialogHeader>
          {!detail && !error ? (
            <div className="flex items-center justify-center gap-2 py-12" role="status">
              <Spinner /> Memuat detail...
            </div>
          ) : null}
          {error || detail === null ? <p className="py-8 text-center text-sm text-muted-foreground">Detail customer tidak dapat dimuat.</p> : null}
          {detail && activityStatus ? (
            <div className="flex flex-col gap-5">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="No. customer" value={detail.customerNo} mono />
                <div>
                  <dt className="text-xs text-muted-foreground">Status aktivitas</dt>
                  <dd className="mt-1"><CustomerActivityBadge status={activityStatus} archived={Boolean(detail.archivedAt)} /></dd>
                </div>
                <Info label="Nama" value={detail.name} />
                <Info label="Perusahaan/komunitas" value={detail.companyName ?? "-"} />
                <Info label="Jenis customer" value={detail.customerType.name} />
                <Info label="Sumber lead" value={detail.leadSource?.name ?? "-"} />
                <Info label="Sales/PIC" value={detail.salesPic?.name ?? "Belum ditugaskan"} />
                <Info label="Kota" value={detail.city ?? "-"} />
                <Info label="Diperbarui" value={formatDate(detail.updatedAt, true)} />
              </dl>

              <dl className="grid gap-4 sm:grid-cols-3">
                <Info label="WhatsApp" value={detail.whatsapp ?? "-"} />
                <Info label="Email" value={detail.email ?? "-"} />
                <Info label="Instagram" value={detail.instagram ? `@${detail.instagram}` : "-"} />
              </dl>

              {detail.address || detail.notes ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Info label="Alamat" value={detail.address ?? "-"} />
                  <Info label="Catatan" value={detail.notes ?? "-"} />
                </dl>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-medium">Peluang terbaru</h3>
                {detail.opportunities.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Peluang</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Diperbarui</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.opportunities.map((opportunity) => (
                        <TableRow key={opportunity.id}>
                          <TableCell>
                            <Link href={`/crm/peluang/${opportunity.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                              {opportunity.title}
                            </Link>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</p>
                          </TableCell>
                          <TableCell><OpportunityStatusBadge stage={opportunity.stage} /></TableCell>
                          <TableCell>{formatDate(opportunity.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Empty className="rounded-lg border p-6">
                    <EmptyHeader>
                      <EmptyTitle>Belum ada peluang</EmptyTitle>
                      <EmptyDescription>Peluang baru bisa dibuat dari profil lengkap customer.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Sales order terbaru</h3>
                {salesOrders.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.salesOrderNo}</TableCell>
                          <TableCell><SalesOrderStatusBadge status={order.status} /></TableCell>
                          <TableCell>{formatDate(order.acceptedAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(order.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Empty className="rounded-lg border p-6">
                    <EmptyHeader>
                      <EmptyTitle>Belum ada sales order</EmptyTitle>
                      <EmptyDescription>Order muncul setelah peluang masuk Deal.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>
          ) : null}
          {detail ? (
            <DialogFooter>
              <Button nativeButton={false} render={<Link href={`/customers/${detail.id}`} />}>Buka profil lengkap</Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 font-mono" : "mt-1 whitespace-pre-wrap"}>{value}</dd>
    </div>
  );
}
