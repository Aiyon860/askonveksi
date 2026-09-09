"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { AlertTriangle, CalendarClock, GripVertical, UserRound } from "lucide-react";
import type { ProductionRoute, ProductionStage } from "@prisma/client";

import { moveProductionOptimisticAction } from "@/app/actions/production";
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
import type { getProductionBoard } from "@/lib/production/data";
import { nextProductionStage, productionStages, PRODUCTION_STAGE_LABEL } from "@/lib/production/workflow";
import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/production/stage-theme";
import { cn } from "@/lib/utils";

type BoardItem = Awaited<ReturnType<typeof getProductionBoard>>["items"][number];
type PendingMove = { item: BoardItem; targetStage: ProductionStage; decision: "ADVANCE" | "SKIP" | "SAMPLE_REJECT" | "QC_REJECT" };
type RecentMove = { id: string; stage: ProductionStage };

const DROP_ANIMATION = { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };

function stageOptions(item: BoardItem) {
  const next = nextProductionStage(item.stageSequence, item.currentStage);
  const options: PendingMove[] = next ? [{ item, targetStage: next, decision: "ADVANCE" }] : [];
  if (item.route === "NON_JERSEY" && next) {
    const nextIndex = item.stageSequence.indexOf(next);
    options.push(...item.stageSequence.slice(nextIndex + 1).map((targetStage) => ({ item, targetStage, decision: "SKIP" as const })));
  }
  if (item.currentStage === "PERSETUJUAN_SAMPEL") options.push({ item, targetStage: "TEST_PRINT", decision: "SAMPLE_REJECT" });
  if (item.currentStage === "QC") {
    const qcIndex = item.stageSequence.indexOf("QC");
    options.push(...item.stageSequence.slice(0, qcIndex).map((targetStage) => ({ item, targetStage, decision: "QC_REJECT" as const })));
  }
  return options;
}

function optionValue(move: PendingMove) {
  return `${move.decision}:${move.targetStage}`;
}

export function ProductionBoard({ route, items }: { route: ProductionRoute; items: BoardItem[] }) {
  const router = useRouter();
  const [boardItems, moveOptimistically] = useOptimistic(items, (current, move: { id: string; targetStage: ProductionStage }) => current.map((item) => item.id === move.id ? { ...item, currentStage: move.targetStage } : item));
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
  const columns = productionStages(route);
  const activeItem = activeId ? boardItems.find((item) => item.id === activeId) ?? null : null;

  useEffect(() => {
    if (!recentMove) return;
    const timeout = window.setTimeout(() => setRecentMove(null), 240);
    return () => window.clearTimeout(timeout);
  }, [recentMove]);

  function requestMove(item: BoardItem, targetStage?: ProductionStage, preview = false) {
    const options = stageOptions(item);
    const move = targetStage ? options.find((option) => option.targetStage === targetStage && (option.decision === "ADVANCE" || option.decision === "SKIP")) : options[0];
    if (move) {
      if (preview) setPreviewMove(move);
      setPendingMove(move);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const item = boardItems.find((candidate) => candidate.id === event.active.id);
    if (item) requestMove(item, event.over.id as ProductionStage, true);
  }

  function confirmMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove) return;
    const formData = new FormData(event.currentTarget);
    const selected = String(formData.get("moveOption") ?? "");
    const [decision, targetStage] = selected.split(":") as [PendingMove["decision"], ProductionStage];
    formData.set("decision", decision);
    formData.set("targetStage", targetStage);
    const { item, targetStage: stage } = pendingMove;
    setPendingMove(null);
    startMoving(async () => {
      setRecentMove({ id: item.id, stage });
      moveOptimistically({ id: item.id, targetStage: stage });
      setPreviewMove(null);
      const result = await moveProductionOptimisticAction(formData);
      if (!result.ok) {
        setRecentMove(null);
        toast.add({ title: "Progres tidak berubah", description: result.message, type: "error" });
        return;
      }
      toast.add({ title: "Progres disimpan", description: `${item.workOrderNo} dipindahkan ke ${PRODUCTION_STAGE_LABEL[stage]}.`, type: "success" });
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative">
        {isMoving ? <div className="fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm animate-in fade-in-0 slide-in-from-top-2 items-center gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg" role="status"><Spinner /> Menyimpan progres...</div> : null}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: "Tekan spasi untuk mengambil kartu. Gunakan tombol panah untuk memilih tahap tujuan, lalu tekan spasi lagi untuk meletakkan." } }}
        >
        <div className="grid auto-cols-[20rem] snap-x snap-proximity grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3" aria-label={`Kanban produksi ${route === "JERSEY" ? "Jersey" : "Non-Jersey"}`}>
          {columns.map((stage) => {
            const stageItems = boardItems.filter((item) => (previewMove?.item.id === item.id ? previewMove.targetStage : item.currentStage) === stage);
            return (
              <ProductionStageColumn
                key={stage}
                stage={stage}
                canDrop={Boolean(activeItem && stageOptions(activeItem).some((option) => option.targetStage === stage && (option.decision === "ADVANCE" || option.decision === "SKIP")))}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`production-stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{PRODUCTION_STAGE_LABEL[stage]}</h2>
                  <span key={stageItems.length} className="animate-in fade-in-0 duration-150 font-mono text-xs tabular-nums text-muted-foreground">{stageItems.length}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                  <div className="flex flex-col gap-2">
                  {stageItems.length ? stageItems.map((item) => {
                    const options = stageOptions(item);
                    const canAdvance = Boolean(options.find((option) => option.decision === "ADVANCE"));
                    const draggable = !isMoving && !previewMove && canAdvance;
                    const overdue = item.status === "ACTIVE" && new Date(item.deadline).getTime() < new Date().setHours(0, 0, 0, 0);
                    return (
                      <DraggableProductionCard
                        key={item.id}
                        item={item}
                        draggable={draggable}
                        entering={recentMove?.id === item.id && recentMove.stage === stage}
                        previewing={previewMove?.item.id === item.id}
                      >
                        {(drag) => <Card size="sm" className={cn("cursor-default", item.needsRepair && "border-destructive/50 bg-destructive/5")}>
                        <CardHeader>
                          <CardTitle><Link href={`/produksi/${item.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{item.productName}</Link></CardTitle>
                          <CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription>
                          <CardAction><Button ref={drag.setActivatorNodeRef} type="button" variant="ghost" size="icon-sm" className="cursor-grab touch-none active:cursor-grabbing" aria-label={`Geser ${item.workOrderNo}`} disabled={!drag.draggable} {...drag.attributes} {...drag.listeners}><GripVertical aria-hidden="true" /></Button></CardAction>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="font-mono">{item.workOrderNo}</Badge>
                            <Badge variant="secondary">{item.quantity} pcs</Badge>
                            {item.needsRepair ? <Badge variant="destructive">Perlu Perbaikan</Badge> : null}
                            {overdue ? <Badge variant="warning">Terlambat</Badge> : null}
                            {item.route === "JERSEY" && item.sampleRevision > 1 ? <Badge variant="warning">Revisi sampel {item.sampleRevision}</Badge> : null}
                          </div>
                          {item.needsRepair ? <p className="line-clamp-2 text-xs leading-5 text-destructive"><AlertTriangle aria-hidden="true" className="mr-1 inline size-3.5" />{item.repairReason}</p> : null}
                          <dl className="grid gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between gap-3"><dt>Sales Order</dt><dd className="font-mono text-foreground">{item.salesOrder.salesOrderNo}</dd></div>
                            <div className="flex items-center justify-between gap-3">
                              <dt>Deadline produksi</dt>
                              <dd className={cn("flex items-center gap-2", overdue && "font-medium text-destructive")}><CalendarClock aria-hidden="true" className="size-3.5" />{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(item.deadline))}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt>PIC</dt>
                              <dd className="flex items-center gap-2"><UserRound aria-hidden="true" className="size-3.5" />{item.assignee?.name ?? "Belum ditentukan"}</dd>
                            </div>
                          </dl>
                          {item.status === "ACTIVE" && options.length ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => requestMove(item)}>Perbarui tahap</Button> : null}
                        </CardContent>
                      </Card>}</DraggableProductionCard>
                    );
                  }) : <Empty className="min-h-32 p-4"><EmptyHeader><EmptyTitle className="text-sm">Belum ada pekerjaan</EmptyTitle><EmptyDescription>Work Order pada tahap ini akan muncul di sini.</EmptyDescription></EmptyHeader></Empty>}
                  </div>
                </div>
              </ProductionStageColumn>
            );
          })}
        </div>
        <DragOverlay dropAnimation={reducedMotion ? null : DROP_ANIMATION}>{activeItem ? <ProductionDragPreview item={activeItem} /> : null}</DragOverlay>
        </DndContext>
      </div>

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => { if (!open) { setPendingMove(null); setPreviewMove(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perbarui tahap produksi</DialogTitle>
            <DialogDescription>{pendingMove ? `${pendingMove.item.workOrderNo} · ${pendingMove.item.productName}` : "Pilih perubahan tahap."}</DialogDescription>
          </DialogHeader>
          {pendingMove ? (
            <form onSubmit={confirmMove}>
              <input type="hidden" name="workOrderId" value={pendingMove.item.id} />
              <input type="hidden" name="version" value={pendingMove.item.version} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="moveOption" required>Perubahan</FieldLabel>
                  <NativeSelect id="moveOption" name="moveOption" defaultValue={optionValue(pendingMove)} className="w-full" onChange={(event) => {
                    const selected = stageOptions(pendingMove.item).find((option) => optionValue(option) === event.target.value);
                    if (selected) {
                      setPendingMove(selected);
                      if (previewMove) setPreviewMove(selected);
                    }
                  }}>
                    {stageOptions(pendingMove.item).map((option) => <NativeSelectOption key={optionValue(option)} value={optionValue(option)}>{option.decision === "SAMPLE_REJECT" ? "Minta Test Print ulang" : option.decision === "QC_REJECT" ? `Perbaiki di ${PRODUCTION_STAGE_LABEL[option.targetStage]}` : option.decision === "SKIP" ? `Lewati ke ${PRODUCTION_STAGE_LABEL[option.targetStage]}` : `Lanjut ke ${PRODUCTION_STAGE_LABEL[option.targetStage]}`}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                {pendingMove.decision !== "ADVANCE" ? <Field><FieldLabel htmlFor="productionMoveNote" required>Alasan</FieldLabel><Textarea id="productionMoveNote" name="note" required minLength={3} maxLength={2000} rows={4} /></Field> : null}
                <Button type="submit" disabled={isMoving}>Simpan progres</Button>
              </FieldGroup>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductionStageColumn({ stage, canDrop, children }: { stage: ProductionStage; canDrop: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage, disabled: !canDrop });
  return <section ref={setNodeRef} aria-labelledby={`production-stage-${stage}`} className={cn("flex h-[clamp(24rem,calc(100svh-14rem),44rem)] snap-start flex-col overflow-hidden rounded-lg border p-2", STAGE_SURFACE_CLASS[stage], isOver && "bg-primary/5 ring-2 ring-primary/20")}>{children}</section>;
}

function DraggableProductionCard({ item, draggable, entering, previewing, children }: { item: BoardItem; draggable: boolean; entering: boolean; previewing: boolean; children: (drag: ReturnType<typeof useDraggable> & { draggable: boolean }) => React.ReactNode }) {
  const drag = useDraggable({ id: item.id, disabled: !draggable });
  return <div ref={drag.setNodeRef} className={cn(drag.isDragging && "opacity-35", previewing && "opacity-50", entering && "animate-in fade-in-0 slide-in-from-left-2 duration-200")}>{children({ ...drag, draggable })}</div>;
}

function ProductionDragPreview({ item }: { item: BoardItem }) {
  return <Card size="sm" className={cn("w-[20rem] scale-[1.02] shadow-lg", item.needsRepair && "border-destructive/50 bg-destructive/5")}><CardHeader><CardTitle>{item.productName}</CardTitle><CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2"><Badge variant="outline" className="font-mono">{item.workOrderNo}</Badge><Badge variant="secondary">{item.quantity} pcs</Badge></div></CardContent></Card>;
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
