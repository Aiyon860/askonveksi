"use client";

import { useState } from "react";
import { FileUp, History } from "lucide-react";

import { reviewDesignRevisionAction, uploadDesignRevisionAction } from "@/app/actions/design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilePicker } from "@/components/ui/file-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type Revision = { id: string; revision: number; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"; notes: string | null; reviewNotes: string | null; createdAt: string; reviewedAt: string | null; createdBy: { name: string }; reviewedBy: { name: string } | null; attachments: Array<{ id: string; originalName: string }> };

const REVIEW_LABEL = { PENDING_REVIEW: "Menunggu persetujuan", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;
const REVIEW_VARIANT = { PENDING_REVIEW: "secondary", APPROVED: "success", REJECTED: "destructive" } as const;

export function DesignTaskActions({ taskId, purchaseOrderNo, revisions, canUpload, canReview }: { taskId: string; purchaseOrderNo: string; revisions: Revision[]; canUpload: boolean; canReview: boolean }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rejectRevision, setRejectRevision] = useState<Revision | null>(null);
  const nextRevision = (revisions[0]?.revision ?? 0) + 1;
  const latest = revisions[0];
  const canCreateRevision = canUpload && (!latest || latest.status === "REJECTED") && revisions.length < 4;

  return <div className="flex flex-wrap justify-end gap-2">
    {canUpload ? <Button size="sm" onClick={() => setUploadOpen(true)} disabled={!canCreateRevision}><FileUp data-icon="inline-start" aria-hidden="true" />{revisions.length ? "Revisi desain" : "Upload desain"}</Button> : null}
    <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)} disabled={!revisions.length}><History data-icon="inline-start" aria-hidden="true" />Riwayat</Button>
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{revisions.length ? `Unggah revisi ${nextRevision}` : "Unggah desain"}</DialogTitle><DialogDescription>{purchaseOrderNo}. File baru selalu disimpan sebagai versi terpisah.</DialogDescription></DialogHeader>
        <form action={uploadDesignRevisionAction} onSubmit={() => setUploadOpen(false)}>
          <input type="hidden" name="designTaskId" value={taskId} />
          <FieldGroup>
            <Field><FieldLabel htmlFor={`design-files-${taskId}`} required>File desain</FieldLabel><FilePicker id={`design-files-${taskId}`} name="designFiles" required multiple accept=".png,.psd,image/png,image/vnd.adobe.photoshop,application/x-photoshop" /><FieldDescription>PNG atau PSD, maksimal 5 file dan 5 MB per file.</FieldDescription></Field>
            <Field><FieldLabel htmlFor={`design-notes-${taskId}`}>Catatan revisi</FieldLabel><Textarea id={`design-notes-${taskId}`} name="notes" maxLength={4000} rows={3} placeholder="Contoh: Perubahan warna logo depan." /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Batal</Button><Button type="submit">Kirim versi {nextRevision} untuk persetujuan</Button></DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Riwayat desain {purchaseOrderNo}</DialogTitle><DialogDescription>Setiap versi menyimpan keputusan dan catatan peninjauan.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-4">{revisions.map((revision) => <section key={revision.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><strong>Versi {revision.revision}</strong><Badge variant={REVIEW_VARIANT[revision.status]}>{REVIEW_LABEL[revision.status]}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Diunggah oleh {revision.createdBy.name} · {new Date(revision.createdAt).toLocaleString("id-ID")}</p>{revision.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{revision.notes}</p> : null}<ul className="mt-3 flex flex-col gap-1 text-sm">{revision.attachments.map((attachment) => <li key={attachment.id}><a className="text-primary underline-offset-4 hover:underline" href={`/api/desain/${taskId}/attachments/${attachment.id}`}>{attachment.originalName}</a></li>)}</ul>{revision.reviewedBy ? <p className="mt-3 text-sm text-muted-foreground">{revision.status === "APPROVED" ? "Disetujui" : "Ditolak"} oleh {revision.reviewedBy.name}{revision.reviewedAt ? ` · ${new Date(revision.reviewedAt).toLocaleString("id-ID")}` : ""}</p> : null}{revision.reviewNotes ? <p className="mt-2 whitespace-pre-wrap text-sm">{revision.reviewNotes}</p> : null}{canReview && revision.status === "PENDING_REVIEW" ? <div className="mt-3 flex flex-wrap gap-2"><form action={reviewDesignRevisionAction}><input type="hidden" name="designRevisionId" value={revision.id} /><input type="hidden" name="decision" value="APPROVED" /><Button size="sm" type="submit">Setujui</Button></form><Button size="sm" variant="outline" onClick={() => setRejectRevision(revision)}>Tolak</Button></div> : null}</section>)}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(rejectRevision)} onOpenChange={(open) => { if (!open) setRejectRevision(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Tolak desain</DialogTitle><DialogDescription>{rejectRevision ? `Berikan catatan untuk versi ${rejectRevision.revision} agar Desainer dapat memperbaikinya.` : ""}</DialogDescription></DialogHeader>
        {rejectRevision ? <form action={reviewDesignRevisionAction} onSubmit={() => setRejectRevision(null)}><input type="hidden" name="designRevisionId" value={rejectRevision.id} /><input type="hidden" name="decision" value="REJECTED" /><FieldGroup><Field><FieldLabel htmlFor={`review-notes-${rejectRevision.id}`} required>Catatan penolakan</FieldLabel><Textarea id={`review-notes-${rejectRevision.id}`} name="reviewNotes" required maxLength={4000} rows={3} placeholder="Contoh: Warna logo perlu disesuaikan dengan brand customer." /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setRejectRevision(null)}>Batal</Button><Button type="submit" variant="destructive">Tolak desain</Button></DialogFooter></FieldGroup></form> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
