"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, GripVertical, UserRound } from "lucide-react";
import type { ProductionRoute, ProductionStage } from "@prisma/client";

import { moveProductionOptimisticAction } from "@/app/actions/production";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { getProductionBoard } from "@/lib/production/data";
import { nextProductionStage, productionStages, PRODUCTION_STAGE_LABEL } from "@/lib/production/workflow";
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
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, startMoving] = useTransition();
  const columns = productionStages(route);

  function requestMove(item: BoardItem, targetStage?: ProductionStage) {
    const options = stageOptions(item);
    const move = targetStage ? options.find((option) => option.targetStage === targetStage && (option.decision === "ADVANCE" || option.decision === "SKIP")) : options[0];
    if (move) setPendingMove(move);
  }

  function confirmMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove) return;
    const formData = new FormData(event.currentTarget);
    const selected = String(formData.get("moveOption") ?? "");
    const [decision, targetStage] = selected.split(":") as [PendingMove["decision"], ProductionStage];
    formData.set("decision", decision);
    formData.set("targetStage", targetStage);
    setMoveError(null);
    setPendingMove(null);
    startMoving(async () => {
      moveOptimistically({ id: pendingMove.item.id, targetStage });
      const result = await moveProductionOptimisticAction(formData);
      if (!result.ok) setMoveError(result.message);
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative">
        {moveError ? <Alert variant="destructive" className="mb-3"><AlertTitle>Progres tidak berubah</AlertTitle><AlertDescription>{moveError}</AlertDescription></Alert> : null}
        {isMoving ? <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs shadow-sm" role="status"><Spinner /> Menyimpan progres...</div> : null}
        <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3" aria-label={`Kanban produksi ${route === "JERSEY" ? "Jersey" : "Non-Jersey"}`}>
          {columns.map((stage) => {
            const stageItems = boardItems.filter((item) => item.currentStage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`production-stage-${stage}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const item = boardItems.find((candidate) => candidate.id === event.dataTransfer.getData("text/production-work-order-id"));
                  if (item) requestMove(item, stage);
                }}
                className="min-h-[24rem] rounded-xl border bg-muted/35 p-2"
              >
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`production-stage-${stage}`} className="text-sm font-semibold">{PRODUCTION_STAGE_LABEL[stage]}</h2>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{stageItems.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stageItems.length ? stageItems.map((item) => {
                    const options = stageOptions(item);
                    const overdue = item.status === "ACTIVE" && new Date(item.deadline).getTime() < new Date().setHours(0, 0, 0, 0);
                    return (
                      <Card
                        key={item.id}
                        size="sm"
                        draggable={!isMoving && Boolean(options.find((option) => option.decision === "ADVANCE"))}
                        onDragStart={(event) => event.dataTransfer.setData("text/production-work-order-id", item.id)}
                        className={cn(item.needsRepair && "border-destructive/50 bg-destructive/5")}
                      >
                        <CardHeader>
                          <CardTitle><Link href={`/produksi/${item.id}`} className="underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50">{item.productName}</Link></CardTitle>
                          <CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription>
                          <CardAction><GripVertical aria-label="Geser kartu" className="size-4 text-muted-foreground" /></CardAction>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{item.workOrderNo}</Badge>
                            <Badge variant="secondary">{item.quantity} pcs</Badge>
                            {item.needsRepair ? <Badge variant="destructive">Perlu Perbaikan</Badge> : null}
                            {overdue ? <Badge variant="warning">Terlambat</Badge> : null}
                            {item.route === "JERSEY" && item.sampleRevision > 1 ? <Badge variant="warning">Revisi sampel {item.sampleRevision}</Badge> : null}
                          </div>
                          {item.needsRepair ? <p className="line-clamp-2 text-xs leading-5 text-destructive"><AlertTriangle aria-hidden="true" className="mr-1 inline size-3.5" />{item.repairReason}</p> : null}
                          <dl className="grid gap-2 text-xs text-muted-foreground">
                            <div className="flex justify-between gap-3"><dt>Sales Order</dt><dd className="font-mono text-foreground">{item.salesOrder.salesOrderNo}</dd></div>
                            <div className="flex items-center gap-2"><CalendarClock aria-hidden="true" className="size-3.5" /><dd>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(item.deadline))}</dd></div>
                            <div className="flex items-center gap-2"><UserRound aria-hidden="true" className="size-3.5" /><dd>{item.assignee?.name ?? "PIC belum ditentukan"}</dd></div>
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
