"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CalendarClock, FilePlus2, GripVertical, NotebookText } from "lucide-react";
import type { AppRole, OpportunityStage } from "@prisma/client";

import { moveOpportunityStageOptimisticAction } from "@/app/actions/crm";
import { DealPaymentForm } from "@/components/crm/deal-payment-form";
import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { CRM_OPERATOR_ROLES, DEAL_ROLES, hasRole } from "@/lib/auth/permissions";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";
import { formatDate } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

type PendingMove = { opportunity: PipelineOpportunity; stage: OpportunityStage };
type RecentMove = { id: string; stage: OpportunityStage };

const DROP_ANIMATION = { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };

const DEFAULT_DESTINATION: Record<OpportunityStage, OpportunityStage> = {
  LEAD_BARU: "NEGOSIASI",
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
  const [previewMove, setPreviewMove] = useState<PendingMove | null>(null);
  const [isMoving, startMoving] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recentMove, setRecentMove] = useState<RecentMove | null>(null);
  const reducedMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const canOperate = hasRole(actorRole, CRM_OPERATOR_ROLES);
  const canCompleteDeal = hasRole(actorRole, DEAL_ROLES);
  const activeOpportunity = activeId ? boardOpportunities.find((item) => item.id === activeId) ?? null : null;

  useEffect(() => {
    if (!recentMove) return;
    const timeout = window.setTimeout(() => setRecentMove(null), 240);
    return () => window.clearTimeout(timeout);
  }, [recentMove]);

  function requestMove(opportunity: PipelineOpportunity, stage: OpportunityStage, preview = false) {
    if (!canOperate) return;
    if (opportunity.stage === stage) return;
    if (preview) setPreviewMove({ opportunity, stage });
    setPendingMove({ opportunity, stage });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const opportunity = boardOpportunities.find((item) => item.id === event.active.id);
    if (opportunity) requestMove(opportunity, event.over.id as OpportunityStage, true);
  }

  function confirmMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove) return;

    const data = new FormData(event.currentTarget);
    const { opportunity, stage } = pendingMove;
    setPendingMove(null);

    startMoving(async () => {
      setRecentMove({ id: opportunity.id, stage });
      moveOptimistically({ opportunityId: opportunity.id, stage });
      setPreviewMove(null);
      const result = await moveOpportunityStageOptimisticAction(data);
      if (!result.ok) {
        setRecentMove(null);
        toast.add({ title: "Status tidak berubah", description: result.message, type: result.kind });
        return;
      }
      toast.add({ title: "Status diperbarui", description: `${opportunity.opportunityNo} dipindahkan ke ${STAGE_LABEL[stage]}.`, type: "success" });
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative">
        {isMoving ? (
          <div className="fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm animate-in fade-in-0 slide-in-from-top-2 items-center gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg" role="status">
            <Spinner /> Memindahkan status...
          </div>
        ) : null}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: "Tekan spasi untuk mengambil kartu. Gunakan tombol panah untuk memilih kolom tujuan, lalu tekan spasi lagi untuk meletakkan." } }}
        >
        <div className="grid auto-cols-[20rem] snap-x snap-proximity grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3">
          {PIPELINE_STAGES.map((stage) => {
            const items = boardOpportunities.filter((opportunity) => (previewMove?.opportunity.id === opportunity.id ? previewMove.stage : opportunity.stage) === stage);
            return (
              <PipelineStageColumn
                key={stage}
                stage={stage}
                canDrop={Boolean(activeOpportunity && activeOpportunity.stage !== stage)}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{stage === "DEAL" ? "Deal (SO)" : STAGE_LABEL[stage]}</h2>
                  <span key={items.length} className="animate-in fade-in-0 duration-150 font-mono text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                  <div className="flex flex-col gap-2">
                  {items.length ? items.map((opportunity) => (
                    <DraggablePipelineCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      draggable={canOperate && !isMoving && !previewMove && opportunity.stage !== "DEAL"}
                      entering={recentMove?.id === opportunity.id && recentMove.stage === stage}
                      previewing={previewMove?.opportunity.id === opportunity.id}
                    >
                      {(drag) => <Card size="sm" className="cursor-default">
                      <CardHeader>
                        <CardTitle>
                          <Link href={`/crm/peluang/${opportunity.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                            {opportunity.customer.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>{opportunity.title}{opportunity.customer.companyName ? ` · ${opportunity.customer.companyName}` : ""}</CardDescription>
                        {canOperate ? <CardAction>
                          <Button ref={drag.setActivatorNodeRef} type="button" variant="ghost" size="icon-sm" className="cursor-grab touch-none active:cursor-grabbing" aria-label={`Geser ${opportunity.customer.name}`} disabled={!drag.draggable} {...drag.attributes} {...drag.listeners}>
                            <GripVertical aria-hidden="true" />
                          </Button>
                        </CardAction> : null}
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-2">
                          {opportunity.stage === "DEAL" ? <Badge variant="success">Deal (SO)</Badge> : <OpportunityStatusBadge stage={opportunity.stage} />}
                          <span className="font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</span>
                        </div>
                        <dl className="grid gap-2 text-xs text-muted-foreground">
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
                              {opportunity.invoice?.pendingPayment ? <div className="flex justify-between gap-3"><dt>{new Date(opportunity.invoice.pendingPayment.initialDueAt).getTime() < new Date(new Date().toDateString()).getTime() ? `Deadline ${opportunity.invoice.pendingPayment.kind} terlewat` : `Menunggu ${opportunity.invoice.pendingPayment.kind}`}</dt><dd className="text-right text-foreground">{formatDate(opportunity.invoice.pendingPayment.initialDueAt)}</dd></div> : null}
                              {opportunity.salesOrder ? <div className="flex justify-between gap-3"><dt>Pembayaran</dt><dd className="text-foreground">{opportunity.salesOrder.paymentKind ?? "-"}</dd></div> : null}
                            </div>
                          ) : null}
                        </dl>
                        {canOperate && opportunity.stage === "NEGOSIASI" && !opportunity.purchaseOrder ? (
                          <Button variant="outline" size="sm" className="w-full" render={<Link href={`/crm/peluang/${opportunity.id}?tab=po`} />} nativeButton={false}>
                            <FilePlus2 data-icon="inline-start" aria-hidden="true" />Tambah PO
                          </Button>
                        ) : null}
                        {canOperate && opportunity.stage === "NEGOSIASI" && opportunity.purchaseOrder?.status === "AGREED" && (!opportunity.invoice || opportunity.invoice.status === "SUPERSEDED") ? (
                          <Button variant="outline" size="sm" className="w-full" render={<Link href={`/crm/peluang/${opportunity.id}?tab=invoice`} />} nativeButton={false}>
                            <FilePlus2 data-icon="inline-start" aria-hidden="true" />Tambah invoice
                          </Button>
                        ) : null}
                        {canOperate && opportunity.stage !== "DEAL" ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPendingMove({ opportunity, stage: DEFAULT_DESTINATION[opportunity.stage] })}>Ubah status</Button> : null}
                      </CardContent>
                    </Card>}</DraggablePipelineCard>
                  )) : (
                    <Empty className="min-h-32 p-4">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm">Belum ada peluang</EmptyTitle>
                        <EmptyDescription>Tarik kartu ke kolom ini atau gunakan menu status.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  </div>
                </div>
              </PipelineStageColumn>
            );
          })}
        </div>
        <DragOverlay dropAnimation={reducedMotion ? null : DROP_ANIMATION}>{activeOpportunity ? <PipelineDragPreview opportunity={activeOpportunity} /> : null}</DragOverlay>
        </DndContext>
      </div>

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => { if (!open) { setPendingMove(null); setPreviewMove(null); } }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Konfirmasi perubahan status</DialogTitle>
            <DialogDescription>
              {pendingMove ? `${pendingMove.opportunity.opportunityNo} · ${pendingMove.opportunity.title}` : "Pilih status tujuan."}
            </DialogDescription>
          </DialogHeader>
          {pendingMove ? (
            pendingMove.stage === "DEAL" ? (
              !canCompleteDeal ? (
                <Alert>
                  <AlertTitle>Deal memerlukan Owner atau Admin</AlertTitle>
                  <AlertDescription>Sales dapat menyiapkan PO dan invoice. Owner atau Admin mencatat pembayaran dan memindahkan peluang ke Deal.</AlertDescription>
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
                      onChange={(event) => {
                        const stage = event.target.value as OpportunityStage;
                        setPendingMove({ ...pendingMove, stage });
                        if (previewMove) setPreviewMove({ ...previewMove, stage });
                      }}
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

function PipelineStageColumn({ stage, canDrop, children }: { stage: OpportunityStage; canDrop: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage, disabled: !canDrop });
  return <section ref={setNodeRef} aria-labelledby={`stage-${stage}`} className={cn("flex h-[clamp(24rem,calc(100svh-14rem),44rem)] snap-start flex-col overflow-hidden rounded-lg border p-2", STAGE_SURFACE_CLASS[stage], isOver && "bg-primary/5 ring-2 ring-primary/20")}>{children}</section>;
}

function DraggablePipelineCard({ opportunity, draggable, entering, previewing, children }: { opportunity: PipelineOpportunity; draggable: boolean; entering: boolean; previewing: boolean; children: (drag: ReturnType<typeof useDraggable> & { draggable: boolean }) => React.ReactNode }) {
  const drag = useDraggable({ id: opportunity.id, disabled: !draggable });
  return <div ref={drag.setNodeRef} className={cn(drag.isDragging && "opacity-35", previewing && "opacity-50", entering && "animate-in fade-in-0 slide-in-from-left-2 duration-200")}>{children({ ...drag, draggable })}</div>;
}

function PipelineDragPreview({ opportunity }: { opportunity: PipelineOpportunity }) {
  return <Card size="sm" className="w-[20rem] scale-[1.02] shadow-lg"><CardHeader><CardTitle>{opportunity.customer.name}</CardTitle><CardDescription>{opportunity.title}</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2"><OpportunityStatusBadge stage={opportunity.stage} /><span className="font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</span></div></CardContent></Card>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
