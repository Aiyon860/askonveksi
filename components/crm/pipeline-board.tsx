"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CalendarClock, FilePlus2, GripVertical, NotebookText } from "lucide-react";
import type { AppRole, OpportunityStage } from "@prisma/client";

import { moveOpportunityStageOptimisticAction } from "@/app/actions/crm";
import { DealPaymentForm } from "@/components/crm/deal-payment-form";
import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { leadClassification, PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

type PendingMove = { opportunity: PipelineOpportunity; stage: OpportunityStage };

const DEFAULT_DESTINATION: Record<OpportunityStage, OpportunityStage> = {
  LEAD_BARU: "FOLLOW_UP",
  FOLLOW_UP: "NEGOSIASI",
  NEGOSIASI: "DEAL",
  DEAL: "DEAL",
  LOST: "FOLLOW_UP",
};

export function PipelineBoard({ opportunities, actorRole }: { opportunities: PipelineOpportunity[]; actorRole: AppRole }) {
  const router = useRouter();
  const [boardOpportunities, moveOptimistically] = useOptimistic(
    opportunities,
    (current, move: { opportunityId: string; stage: OpportunityStage }) =>
      current.map((item) => item.id === move.opportunityId ? { ...item, stage: move.stage } : item),
  );
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, startMoving] = useTransition();
  const dragImageRef = useRef<HTMLElement | null>(null);
  const canOperate = actorRole === "ADMIN" || actorRole === "SALES";

  function removeDragImage() {
    dragImageRef.current?.remove();
    dragImageRef.current = null;
  }

  useEffect(() => removeDragImage, []);

  function requestMove(opportunity: PipelineOpportunity, stage: OpportunityStage) {
    if (!canOperate) return;
    if (opportunity.stage === stage) return;
    setPendingMove({ opportunity, stage });
  }

  function handleDrop(event: React.DragEvent, stage: OpportunityStage) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/opportunity-id");
    const opportunity = boardOpportunities.find((item) => item.id === id);
    if (opportunity) requestMove(opportunity, stage);
  }

  function confirmMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove) return;

    const data = new FormData(event.currentTarget);
    const { opportunity, stage } = pendingMove;
    setMoveError(null);
    setPendingMove(null);

    startMoving(async () => {
      moveOptimistically({ opportunityId: opportunity.id, stage });
      const result = await moveOpportunityStageOptimisticAction(data);
      if (!result.ok) {
        setMoveError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative">
        {moveError ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>Status dikembalikan</AlertTitle>
            <AlertDescription>{moveError}</AlertDescription>
          </Alert>
        ) : null}
        {isMoving ? (
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs shadow-sm" role="status">
            <Spinner /> Memindahkan status...
          </div>
        ) : null}
        <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3">
          {PIPELINE_STAGES.map((stage) => {
            const items = boardOpportunities.filter((opportunity) => opportunity.stage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`stage-${stage}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, stage)}
                className={cn("min-h-[24rem] rounded-xl border p-2", STAGE_SURFACE_CLASS[stage])}
              >
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{STAGE_LABEL[stage]}</h2>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.length ? items.map((opportunity) => (
                    <Card
                      key={opportunity.id}
                      size="sm"
                      draggable={canOperate && !isMoving && opportunity.stage !== "DEAL"}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/opportunity-id", opportunity.id);

                        removeDragImage();

                        const card = event.currentTarget;
                        const bounds = card.getBoundingClientRect();
                        const computedStyle = window.getComputedStyle(card);
                        const dragImage = card.cloneNode(true) as HTMLElement;

                        Object.assign(dragImage.style, {
                          position: "fixed",
                          top: "0",
                          left: "-10000px",
                          width: `${bounds.width}px`,
                          height: `${bounds.height}px`,
                          boxSizing: "border-box",
                          margin: "0",
                          backgroundColor: computedStyle.backgroundColor,
                          borderRadius: computedStyle.borderRadius,
                          overflow: "hidden",
                          boxShadow: "none",
                          outline: "none",
                          filter: "none",
                          pointerEvents: "none",
                        });
                        dragImage.setAttribute("aria-hidden", "true");
                        dragImage.inert = true;
                        document.body.appendChild(dragImage);
                        dragImageRef.current = dragImage;

                        event.dataTransfer.setDragImage(
                          dragImage,
                          event.clientX - bounds.left,
                          event.clientY - bounds.top,
                        );
                      }}
                      onDragEnd={removeDragImage}
                      className={cn("cursor-default", canOperate && opportunity.stage !== "DEAL" && "cursor-grab active:cursor-grabbing")}
                    >
                      <CardHeader>
                        <CardTitle>
                          <Link href={`/crm/peluang/${opportunity.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                            {opportunity.customer.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>{opportunity.title}{opportunity.customer.companyName ? ` · ${opportunity.customer.companyName}` : ""}</CardDescription>
                        {canOperate ? <CardAction>
                          <GripVertical aria-label="Geser kartu" className="size-4 text-muted-foreground" />
                        </CardAction> : null}
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-2">
                          <OpportunityStatusBadge stage={opportunity.stage} />
                          <span className="text-xs font-medium">{leadClassification(opportunity.leadScore)} · {opportunity.leadScore}</span>
                          <span className="font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</span>
                        </div>
                        <dl className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <dt>Estimasi</dt>
                            <dd className="font-mono text-foreground">{formatCurrency(opportunity.estimatedValue)}</dd>
                          </div>
                          {opportunity.nextActionAt ? (
                            <div className="flex items-start gap-2">
                              <CalendarClock aria-hidden="true" className="size-3.5" />
                              <dd>{opportunity.nextAction} · {formatDate(opportunity.nextActionAt, true)}</dd>
                            </div>
                          ) : null}
                          {opportunity.salesPic ? <div className="flex justify-between gap-3"><dt>PIC</dt><dd>{opportunity.salesPic.name}</dd></div> : null}
                          <div className="flex items-center gap-2">
                            <NotebookText aria-hidden="true" className="size-3.5" />
                            <dd>{opportunity.activityCount} aktivitas</dd>
                          </div>
                          {opportunity.stage === "NEGOSIASI" || opportunity.stage === "DEAL" ? (
                            <div className="grid gap-1 border-t pt-2">
                              <div className="flex justify-between gap-3"><dt>PO</dt><dd className="text-right text-foreground">{opportunity.purchaseOrder ? `${opportunity.purchaseOrder.purchaseOrderNo} · ${opportunity.purchaseOrder.status === "AGREED" ? "Disepakati" : opportunity.purchaseOrder.status === "DRAFT" ? "Draft" : "Diganti"}` : "Belum ada"}</dd></div>
                              <div className="flex justify-between gap-3"><dt>Invoice</dt><dd className="text-right text-foreground">{opportunity.invoice ? `${opportunity.invoice.invoiceNo} · ${opportunity.invoice.status === "ISSUED" ? "Terbit" : opportunity.invoice.status === "DRAFT" ? "Draft" : "Diganti"}` : "Belum ada"}</dd></div>
                              {opportunity.salesOrder ? <div className="flex justify-between gap-3"><dt>Pembayaran</dt><dd className="text-foreground">{opportunity.salesOrder.paymentKind ?? "-"}</dd></div> : null}
                            </div>
                          ) : null}
                        </dl>
                        {canOperate && opportunity.stage === "NEGOSIASI" && !opportunity.purchaseOrder ? (
                          <Button variant="outline" size="sm" className="w-full" render={<Link href={`/crm/peluang/${opportunity.id}#purchase-orders`} />} nativeButton={false}>
                            <FilePlus2 data-icon="inline-start" aria-hidden="true" />Tambah PO
                          </Button>
                        ) : null}
                        {canOperate && opportunity.stage === "NEGOSIASI" && opportunity.purchaseOrder?.status === "AGREED" && (!opportunity.invoice || opportunity.invoice.status === "SUPERSEDED") ? (
                          <Button variant="outline" size="sm" className="w-full" render={<Link href={`/crm/peluang/${opportunity.id}#invoices`} />} nativeButton={false}>
                            <FilePlus2 data-icon="inline-start" aria-hidden="true" />Tambah invoice
                          </Button>
                        ) : null}
                        {canOperate && opportunity.stage !== "DEAL" ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPendingMove({ opportunity, stage: DEFAULT_DESTINATION[opportunity.stage] })}>Ubah status</Button> : null}
                      </CardContent>
                    </Card>
                  )) : (
                    <Empty className="min-h-32 p-4">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm">Belum ada peluang</EmptyTitle>
                        <EmptyDescription>Tarik kartu ke kolom ini atau gunakan menu status.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Konfirmasi perubahan status</DialogTitle>
            <DialogDescription>
              {pendingMove ? `${pendingMove.opportunity.opportunityNo} · ${pendingMove.opportunity.title}` : "Pilih status tujuan."}
            </DialogDescription>
          </DialogHeader>
          {pendingMove ? (
            pendingMove.stage === "DEAL" ? (
              actorRole !== "ADMIN" ? (
                <Alert>
                  <AlertTitle>Deal memerlukan Admin</AlertTitle>
                  <AlertDescription>Sales dapat menyiapkan PO dan invoice. Admin mencatat pembayaran dan memindahkan peluang ke Deal.</AlertDescription>
                </Alert>
              ) : pendingMove.opportunity.stage !== "NEGOSIASI" || pendingMove.opportunity.purchaseOrder?.status !== "AGREED" || pendingMove.opportunity.invoice?.status !== "ISSUED" || pendingMove.opportunity.invoice.purchaseOrderId !== pendingMove.opportunity.purchaseOrder.id ? (
                <div className="flex flex-col gap-4">
                  <Alert variant="destructive">
                    <AlertTitle>Belum dapat dipindahkan ke Deal</AlertTitle>
                    <AlertDescription>Lengkapi PO Disepakati dan invoice Terbit yang saling terhubung terlebih dahulu.</AlertDescription>
                  </Alert>
                  <Button render={<Link href={`/crm/peluang/${pendingMove.opportunity.id}`} />} nativeButton={false}>Buka detail peluang</Button>
                </div>
              ) : (
                <DealPaymentForm
                  opportunityId={pendingMove.opportunity.id}
                  opportunityVersion={pendingMove.opportunity.version}
                  purchaseOrderId={pendingMove.opportunity.purchaseOrder.id}
                  invoiceId={pendingMove.opportunity.invoice.id}
                  invoiceVersion={pendingMove.opportunity.invoice.version}
                  total={pendingMove.opportunity.invoice.total}
                  initialPaidAt={toDateTimeLocalValue(new Date())}
                  productName={pendingMove.opportunity.purchaseOrder.productName}
                  productionDeadline=""
                />
              )
            ) : (
              <form onSubmit={confirmMove}>
                <input type="hidden" name="opportunityId" value={pendingMove.opportunity.id} />
                <input type="hidden" name="version" value={pendingMove.opportunity.version} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="stage" required>Status tujuan</FieldLabel>
                    <NativeSelect
                      id="stage"
                      name="stage"
                      required
                      value={pendingMove.stage}
                      onChange={(event) => setPendingMove({ ...pendingMove, stage: event.target.value as OpportunityStage })}
                      className="w-full"
                    >
                      {PIPELINE_STAGES.map((stage) => (
                        <NativeSelectOption key={stage} value={stage} disabled={stage === "DEAL"}>{STAGE_LABEL[stage]}{stage === "DEAL" ? " · melalui invoice" : ""}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  {pendingMove.stage === "LOST" ? (
                    <Field>
                      <FieldLabel htmlFor="cancelReason" required>Alasan lost</FieldLabel>
                      <Textarea id="cancelReason" name="cancelReason" required minLength={2} maxLength={1000} rows={4} defaultValue={pendingMove.opportunity.cancelReason ?? ""} />
                    </Field>
                  ) : null}
                  <Button type="submit">Konfirmasi pindah status</Button>
                </FieldGroup>
              </form>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
