"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
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
  const [isMoving, startMoving] = useTransition();
  const dragImageRef = useRef<HTMLElement | null>(null);
  const columns = productionStages(route);

  function removeDragImage() {
    dragImageRef.current?.remove();
    dragImageRef.current = null;
  }

  useEffect(() => removeDragImage, []);

  function requestMove(item: BoardItem, targetStage?: ProductionStage) {
    const options = stageOptions(item);
    const move = targetStage ? options.find((option) => option.targetStage === targetStage && (option.decision === "ADVANCE" || option.decision === "SKIP")) : options[0];
    if (move) setPendingMove(move);
  }

  function handleDrop(event: React.DragEvent, targetStage: ProductionStage) {
    event.preventDefault();
    const item = boardItems.find((candidate) => candidate.id === event.dataTransfer.getData("text/production-work-order-id"));
    if (item) requestMove(item, targetStage);
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
      moveOptimistically({ id: item.id, targetStage: stage });
      const result = await moveProductionOptimisticAction(formData);
      if (!result.ok) {
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
        {isMoving ? <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs shadow-sm" role="status"><Spinner /> Menyimpan progres...</div> : null}
        <div className="grid auto-cols-[17.5rem] snap-x snap-proximity grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3" aria-label={`Kanban produksi ${route === "JERSEY" ? "Jersey" : "Non-Jersey"}`}>
          {columns.map((stage) => {
            const stageItems = boardItems.filter((item) => item.currentStage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`production-stage-${stage}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, stage)}
                className={cn("min-h-[24rem] snap-start rounded-lg border p-2", STAGE_SURFACE_CLASS[stage])}
              >
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`production-stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{PRODUCTION_STAGE_LABEL[stage]}</h2>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{stageItems.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stageItems.length ? stageItems.map((item) => {
                    const options = stageOptions(item);
                    const canAdvance = Boolean(options.find((option) => option.decision === "ADVANCE"));
                    const draggable = !isMoving && canAdvance;
                    const overdue = item.status === "ACTIVE" && new Date(item.deadline).getTime() < new Date().setHours(0, 0, 0, 0);
                    return (
                      <Card
                        key={item.id}
                        size="sm"
                        draggable={draggable}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/production-work-order-id", item.id);

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
                        className={cn("cursor-default", draggable && "cursor-grab active:cursor-grabbing", item.needsRepair && "border-destructive/50 bg-destructive/5")}
                      >
                        <CardHeader>
                          <CardTitle><Link href={`/produksi/${item.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{item.productName}</Link></CardTitle>
                          <CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription>
                          <CardAction><GripVertical aria-label="Geser kartu" className="size-4 text-muted-foreground" /></CardAction>
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
                      </Card>
                    );
                  }) : <Empty className="min-h-32 p-4"><EmptyHeader><EmptyTitle className="text-sm">Belum ada pekerjaan</EmptyTitle><EmptyDescription>Work Order pada tahap ini akan muncul di sini.</EmptyDescription></EmptyHeader></Empty>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(null)}>
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
                    if (selected) setPendingMove(selected);
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
