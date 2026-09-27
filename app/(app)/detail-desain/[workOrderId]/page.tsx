import Link from "next/link";
import { ArrowLeft, ImageOff } from "lucide-react";
import { notFound } from "next/navigation";

import { DesignAnnotationEditor } from "@/components/production/design-annotation-editor";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { designAnnotationsSchema } from "@/lib/production/design-annotations";
import { getProductionDesignDetail } from "@/lib/production/design-detail";

export default async function DesignEditorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const workOrder = await getProductionDesignDetail((await params).workOrderId);
  if (!workOrder) notFound();
  const task = workOrder.salesOrder.purchaseOrder.designTask;
  const attachments = task?.revisions[0]?.attachments ?? [];
  return <>
    <Button variant="ghost" size="sm" render={<Link href="/detail-desain" />} nativeButton={false} className="w-fit"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Kembali ke Detail Desain</Button>
    <PageHeader title={`${workOrder.designCompletedAt ? "Desain final" : "Edit desain"} ${workOrder.workOrderNo}`} description={`${workOrder.productName} · ${workOrder.salesOrder.snapshotCustomerName}`} />
    <PageMessage />
    <div className="mb-6"><Badge variant={workOrder.designCompletedAt ? "success" : "warning"}>{workOrder.designCompletedAt ? "Sudah masuk Produksi" : "Belum dikirim ke Produksi"}</Badge></div>
    {task && attachments.length ? <div className="grid gap-6">{attachments.map((attachment) => <DesignAnnotationEditor key={attachment.id} workOrderId={workOrder.id} taskId={task.id} attachmentId={attachment.id} attachmentName={attachment.originalName} savedAnnotations={designAnnotationsSchema.safeParse(attachment.annotations).data ?? []} readOnly={Boolean(workOrder.designCompletedAt)} />)}</div> : <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><ImageOff aria-hidden="true" />Tidak ada gambar PNG dari revisi desain yang sudah disetujui.</CardContent></Card>}
  </>;
}
