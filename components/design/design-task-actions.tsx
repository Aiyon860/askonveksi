"use client";

import { useState } from "react";
import { FileUp, History } from "lucide-react";

import { uploadDesignRevisionAction } from "@/app/actions/design";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Revision = { id: string; revision: number; notes: string | null; createdAt: string; createdBy: { name: string }; attachments: Array<{ id: string; originalName: string }> };

export function DesignTaskActions({ taskId, purchaseOrderNo, revisions }: { taskId: string; purchaseOrderNo: string; revisions: Revision[] }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const nextRevision = (revisions[0]?.revision ?? 0) + 1;
  return <div className="flex flex-wrap gap-2">
    <Button size="sm" onClick={() => setUploadOpen(true)}><FileUp data-icon="inline-start" aria-hidden="true" />{revisions.length ? "Revisi desain" : "Upload desain"}</Button>
    <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)} disabled={!revisions.length}><History data-icon="inline-start" aria-hidden="true" />Riwayat</Button>
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{revisions.length ? `Unggah revisi ${nextRevision}` : "Unggah desain"}</DialogTitle><DialogDescription>{purchaseOrderNo}. File baru selalu disimpan sebagai versi terpisah.</DialogDescription></DialogHeader>
        <form action={uploadDesignRevisionAction} onSubmit={() => setUploadOpen(false)}>
          <input type="hidden" name="designTaskId" value={taskId} />
          <FieldGroup>
            <Field><FieldLabel htmlFor={`design-files-${taskId}`} required>File desain</FieldLabel><Input id={`design-files-${taskId}`} name="designFiles" type="file" required multiple accept=".png,.psd,image/png,image/vnd.adobe.photoshop,application/x-photoshop" /><FieldDescription>PNG atau PSD, maksimal 5 file dan 5 MB per file.</FieldDescription></Field>
            <Field><FieldLabel htmlFor={`design-notes-${taskId}`}>Catatan revisi</FieldLabel><Textarea id={`design-notes-${taskId}`} name="notes" maxLength={4000} rows={3} placeholder="Contoh: Perubahan warna logo depan." /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Batal</Button><Button type="submit">Simpan versi {nextRevision}</Button></DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Riwayat desain {purchaseOrderNo}</DialogTitle><DialogDescription>Versi lama tetap tersedia sebagai catatan perubahan.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-4">{revisions.map((revision) => <section key={revision.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><strong>Versi {revision.revision}</strong><span className="text-xs text-muted-foreground">{new Date(revision.createdAt).toLocaleString("id-ID")}</span></div><p className="mt-1 text-sm text-muted-foreground">Diunggah oleh {revision.createdBy.name}</p>{revision.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{revision.notes}</p> : null}<ul className="mt-3 flex flex-col gap-1 text-sm">{revision.attachments.map((attachment) => <li key={attachment.id}><a className="text-primary underline-offset-4 hover:underline" href={`/api/desain/${taskId}/attachments/${attachment.id}`}>{attachment.originalName}</a></li>)}</ul></section>)}</div>
      </DialogContent>
    </Dialog>
  </div>;
}
