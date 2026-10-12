import Link from "next/link";
import { createHash } from "node:crypto";
import { ArrowLeft, ImageOff } from "lucide-react";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { designAnnotationsSchema } from "@/lib/production/design-annotations";
import { getProductionDesignDetail } from "@/lib/production/design-detail";
import { DesignAnnotationEditor } from "@/components/production/design-annotation-editor-lazy";

// Token gambar berasal dari path penyimpanan yang selalu baru setiap desain
// diganti, sehingga URL gambar berubah dan anotasi tidak perlu bergantung pada
// status transisi React.
function designImageToken(path: string) {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

export default async function DesignEditorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const result = await getProductionDesignDetail((await params).workOrderId);
  if (!result) notFound();
  const { workOrder, canManage } = result;
  const task = workOrder.salesOrder.purchaseOrder.designTask;
  const attachments = task?.revisions[0]?.attachments ?? [];
  return <>
    <Button variant="ghost" size="sm" render={<Link href="/detail-desain" />} nativeButton={false} className="w-fit"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Kembali ke Detail Desain</Button>
    <PageHeader title={`${!canManage ? "Lihat desain" : workOrder.designCompletedAt ? "Desain final" : "Edit desain"} ${workOrder.workOrderNo}`} description={`${workOrder.productName} · ${workOrder.salesOrder.snapshotCustomerName}`} />
    <PageMessage />
    {!canManage ? (
      <Alert>
        <AlertTitle>Mode lihat saja</AlertTitle>
        <AlertDescription>Anda dapat melihat desain dan keterangannya. Mengubah anotasi, mengganti gambar, dan mengirim ke Produksi hanya untuk tim Produksi.</AlertDescription>
      </Alert>
    ) : null}
    <div className="mb-6"><Badge variant={workOrder.designCompletedAt ? "success" : "warning"}>{workOrder.designCompletedAt ? "Sudah masuk Produksi" : "Belum dikirim ke Produksi"}</Badge></div>
    {task && attachments.length ? <div className="grid gap-6">{attachments.map((attachment) => <DesignAnnotationEditor key={attachment.id} workOrderId={workOrder.id} taskId={task.id} attachmentId={attachment.id} attachmentName={attachment.originalName} imageToken={designImageToken(attachment.path)} savedAnnotations={designAnnotationsSchema.safeParse(attachment.annotations).data ?? []} readOnly={!canManage || Boolean(workOrder.designCompletedAt)} />)}</div> : <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><ImageOff aria-hidden="true" />Tidak ada gambar PNG/JPG dari revisi desain yang sudah disetujui.</CardContent></Card>}
  </>;
}
