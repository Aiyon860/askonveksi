"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CalendarClock, GripVertical, NotebookText, PackageCheck } from "lucide-react";
import type { OpportunityStage } from "@prisma/client";

import { moveOpportunityStageOptimisticAction } from "@/app/actions/crm";
import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

type PendingMove = { opportunity: PipelineOpportunity; stage: OpportunityStage };

export function PipelineBoard({ opportunities }: { opportunities: PipelineOpportunity[] }) {
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

  function removeDragImage() {
    dragImageRef.current?.remove();
    dragImageRef.current = null;
  }

  useEffect(() => removeDragImage, []);

  function requestMove(opportunity: PipelineOpportunity, stage: OpportunityStage) {
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
        <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3 xl:grid-cols-5 xl:auto-cols-auto xl:grid-flow-row xl:overflow-visible">
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
                      draggable={!isMoving && opportunity.stage !== "DEAL"}
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
                      className={cn("cursor-default", opportunity.stage !== "DEAL" && "cursor-grab active:cursor-grabbing")}
                    >
                      <CardHeader>
                        <CardTitle>
                          <Link href={`/crm/peluang/${opportunity.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                            {opportunity.title}
                          </Link>
                        </CardTitle>
                        <CardDescription>{opportunity.customer.name}</CardDescription>
                        <CardAction>
                          <GripVertical aria-label="Geser kartu" className="size-4 text-muted-foreground" />
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-2">
                          <OpportunityStatusBadge stage={opportunity.stage} />
                          <span className="font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</span>
                        </div>
                        <dl className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <dt>Estimasi</dt>
                            <dd className="font-mono text-foreground">{formatCurrency(opportunity.estimatedValue)}</dd>
                          </div>
                          {opportunity.followUpAt ? (
                            <div className="flex items-center gap-2">
                              <CalendarClock aria-hidden="true" className="size-3.5" />
                              <dd>{formatDate(opportunity.followUpAt, true)}</dd>
                            </div>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <NotebookText aria-hidden="true" className="size-3.5" />
                            <dd>{opportunity.noteCount} catatan</dd>
                          </div>
                        </dl>
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPendingMove({ opportunity, stage: opportunity.stage })}>
                          Ubah status
                        </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi perubahan status</DialogTitle>
            <DialogDescription>
              {pendingMove ? `${pendingMove.opportunity.opportunityNo} · ${pendingMove.opportunity.title}` : "Pilih status tujuan."}
            </DialogDescription>
          </DialogHeader>
          {pendingMove ? (
            pendingMove.stage === "DEAL" ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                  Deal harus dibuat dari quotation terbit agar snapshot dan Sales Order tercatat atomik.
                </div>
                <Button
                  render={<Link href={`/crm/peluang/${pendingMove.opportunity.id}`} />}
                  nativeButton={false}
                  onClick={() => router.prefetch(`/crm/peluang/${pendingMove.opportunity.id}`)}
                >
                  <PackageCheck data-icon="inline-start" aria-hidden="true" />
                  Buka detail &amp; quotation
                </Button>
              </div>
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
                        <NativeSelectOption key={stage} value={stage} disabled={stage === "DEAL"}>{STAGE_LABEL[stage]}{stage === "DEAL" ? " · melalui quotation" : ""}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  {pendingMove.stage === "FOLLOW_UP" ? (
                    <Field>
                      <FieldLabel htmlFor="followUpAt" required>Jadwal follow-up</FieldLabel>
                      <Input id="followUpAt" name="followUpAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(pendingMove.opportunity.followUpAt)} />
                    </Field>
                  ) : null}
                  {pendingMove.stage === "BATAL" ? (
                    <Field>
                      <FieldLabel htmlFor="cancelReason" required>Alasan batal</FieldLabel>
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
