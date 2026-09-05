import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Circle, RotateCcw, UserRound } from "lucide-react";

import { addProductionNoteAction, assignProductionStepAction, reopenProductionAction } from "@/app/actions/production";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getProductionDetail } from "@/lib/production/data";
import { isStageRole, PRODUCTION_ROUTE_LABEL, PRODUCTION_STAGE_LABEL } from "@/lib/production/workflow";

const ACTIVITY_LABEL = {
  CREATED: "Work Order dibuat",
  STAGE_MOVED: "Tahap diperbarui",
  STAGE_SKIPPED: "Tahap dilewati",
  SAMPLE_REJECTED: "Sampel perlu direvisi",
  QC_REJECTED: "QC meminta perbaikan",
  PIC_ASSIGNED: "PIC ditetapkan",
  NOTE_ADDED: "Catatan ditambahkan",
  REOPENED: "Work Order dibuka kembali",
  CANCELLED: "Work Order dibatalkan",
} as const;

function formatDate(value: Date | null, withTime = false) {
  return value ? new Intl.DateTimeFormat("id-ID", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(value) : "-";
}

export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getProductionDetail(id);
  if (!result) notFound();
  const { workOrder, users, actor } = result;
  const manager = actor.role === "OWNER" || actor.role === "ADMIN";

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href={`/produksi?jalur=${workOrder.route}`} />} nativeButton={false} className="w-fit"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Kembali ke kanban</Button>
      <PageHeader
        title={workOrder.productName}
        description={`${workOrder.workOrderNo} · ${workOrder.salesOrder.salesOrderNo} · ${workOrder.salesOrder.snapshotCustomerName}`}
        action={<Badge variant={workOrder.status === "COMPLETED" ? "success" : workOrder.status === "CANCELLED" ? "destructive" : "secondary"}>{workOrder.status === "COMPLETED" ? "Selesai" : workOrder.status === "CANCELLED" ? "Dibatalkan" : PRODUCTION_STAGE_LABEL[workOrder.currentStage]}</Badge>}
      />
      <PageMessage />

      {workOrder.needsRepair ? <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive"><p className="font-semibold">Perlu Perbaikan</p><p className="mt-1 text-sm leading-6">{workOrder.repairReason}</p><p className="mt-2 text-xs">Dicatat {formatDate(workOrder.repairRequestedAt, true)}</p></div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Tahapan produksi</CardTitle><CardDescription>PIC, percobaan, dan waktu kerja untuk setiap tahap.</CardDescription></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2">
                {workOrder.steps.map((step) => {
                  const candidates = users.filter((user) => step.stage === "QC" ? user.role === "QC" : user.role === "PRODUCTION");
                  const canClaim = !manager && !step.assignee && isStageRole(actor.role, step.stage);
                  return (
                    <li key={step.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        {step.status === "COMPLETED" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : step.status === "ACTIVE" ? <RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{PRODUCTION_STAGE_LABEL[step.stage]}</p><Badge variant={step.status === "COMPLETED" ? "success" : step.status === "ACTIVE" ? "default" : step.status === "SKIPPED" ? "secondary" : "outline"}>{step.status === "COMPLETED" ? "Selesai" : step.status === "ACTIVE" ? "Aktif" : step.status === "SKIPPED" ? "Dilewati" : "Menunggu"}</Badge>{step.attemptCount > 1 ? <Badge variant="warning">Percobaan {step.attemptCount}</Badge> : null}</div>
                          <p className="mt-1 text-xs text-muted-foreground"><UserRound aria-hidden="true" className="mr-1 inline size-3.5" />{step.assignee?.name ?? "PIC belum ditentukan"} · Mulai {formatDate(step.startedAt, true)} · Selesai {formatDate(step.completedAt, true)}</p>
                        </div>
                      </div>
                      {manager && workOrder.status === "ACTIVE" ? (
                        <form action={assignProductionStepAction} className="flex items-center gap-2">
                          <input type="hidden" name="workOrderId" value={workOrder.id} /><input type="hidden" name="stepId" value={step.id} />
                          <NativeSelect name="assigneeId" aria-label={`PIC ${PRODUCTION_STAGE_LABEL[step.stage]}`} defaultValue={step.assignee?.id ?? ""} required>
                            <NativeSelectOption value="" disabled>Pilih PIC</NativeSelectOption>
                            {candidates.map((user) => <NativeSelectOption key={user.id} value={user.id}>{user.name}</NativeSelectOption>)}
                          </NativeSelect>
                          <Button type="submit" size="sm" variant="outline">Simpan</Button>
                        </form>
                      ) : canClaim && workOrder.status === "ACTIVE" ? (
                        <form action={assignProductionStepAction}><input type="hidden" name="workOrderId" value={workOrder.id} /><input type="hidden" name="stepId" value={step.id} /><input type="hidden" name="assigneeId" value={actor.id} /><Button type="submit" size="sm" variant="outline">Ambil tahap</Button></form>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Riwayat aktivitas</CardTitle><CardDescription>Perubahan progres dan catatan tidak dapat dihapus.</CardDescription></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {workOrder.activities.map((activity) => <li key={activity.id} className="border-b pb-4 last:border-0 last:pb-0"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{ACTIVITY_LABEL[activity.type]}</p><time className="text-xs text-muted-foreground">{formatDate(activity.createdAt, true)}</time></div><p className="mt-1 text-xs text-muted-foreground">Oleh {activity.actor.name}{activity.fromStage && activity.toStage ? ` · ${PRODUCTION_STAGE_LABEL[activity.fromStage]} ke ${PRODUCTION_STAGE_LABEL[activity.toStage]}` : activity.toStage ? ` · ${PRODUCTION_STAGE_LABEL[activity.toStage]}` : ""}</p>{activity.note ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{activity.note}</p> : null}</li>)}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Ringkasan</CardTitle><CardDescription>Snapshot kebutuhan produksi dari Sales Order.</CardDescription></CardHeader>
            <CardContent><dl className="grid gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Jalur</dt><dd className="mt-1 font-medium">{PRODUCTION_ROUTE_LABEL[workOrder.route]}</dd></div><div><dt className="text-xs text-muted-foreground">Jumlah</dt><dd className="mt-1 font-mono">{workOrder.quantity} pcs</dd></div><div><dt className="text-xs text-muted-foreground">Deadline</dt><dd className="mt-1"><CalendarClock aria-hidden="true" className="mr-1 inline size-4" />{formatDate(workOrder.deadline)}</dd></div><div><dt className="text-xs text-muted-foreground">Revisi sampel</dt><dd className="mt-1 font-mono">{workOrder.sampleRevision}</dd></div></dl>{manager ? <Button className="mt-4 w-full" variant="outline" render={<Link href={`/sales-orders/${workOrder.salesOrder.id}`} />} nativeButton={false}>Buka Sales Order</Button> : null}</CardContent>
          </Card>

          {workOrder.status !== "CANCELLED" ? <Card><CardHeader><CardTitle>Catatan produksi</CardTitle><CardDescription>Catat kendala atau informasi operasional.</CardDescription></CardHeader><CardContent><form action={addProductionNoteAction}><input type="hidden" name="workOrderId" value={workOrder.id} /><FieldGroup><Field><FieldLabel htmlFor="productionNote" required>Catatan</FieldLabel><Textarea id="productionNote" name="note" required minLength={2} maxLength={2000} rows={4} /></Field><Button type="submit">Tambahkan catatan</Button></FieldGroup></form></CardContent></Card> : null}

          {manager && workOrder.status === "COMPLETED" ? <Card><CardHeader><CardTitle>Buka kembali</CardTitle><CardDescription>Kembalikan Work Order selesai ke tahap perbaikan dengan alasan.</CardDescription></CardHeader><CardContent><form action={reopenProductionAction}><input type="hidden" name="workOrderId" value={workOrder.id} /><input type="hidden" name="version" value={workOrder.version} /><FieldGroup><Field><FieldLabel htmlFor="reopenStage" required>Tahap tujuan</FieldLabel><NativeSelect id="reopenStage" name="targetStage" required className="w-full">{workOrder.stageSequence.filter((stage) => stage !== "SELESAI").map((stage) => <NativeSelectOption key={stage} value={stage}>{PRODUCTION_STAGE_LABEL[stage]}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="reopenNote" required>Alasan</FieldLabel><Textarea id="reopenNote" name="note" required minLength={3} maxLength={2000} rows={4} /></Field><Button type="submit" variant="outline">Buka kembali Work Order</Button></FieldGroup></form></CardContent></Card> : null}
        </aside>
      </div>
    </>
  );
}
