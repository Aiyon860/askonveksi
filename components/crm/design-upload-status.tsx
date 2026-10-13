import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status upload desain pada tabel PO. Satu PO dapat memuat beberapa produk,
 * masing-masing dengan versi desainnya sendiri, jadi kolom ini menampilkan progres.
 */
export function DesignUploadStatus({
  uploadedCount,
  itemCount,
  revisionCount,
  className,
  captionClassName,
}: {
  uploadedCount: number;
  itemCount: number;
  revisionCount: number;
  className?: string;
  captionClassName?: string;
}) {
  const complete = itemCount > 0 && uploadedCount >= itemCount;
  const label = complete ? "Sudah Didesain" : uploadedCount > 0 ? "Sebagian Didesain" : "Belum Didesain";
  const caption = itemCount > 1 ? `${uploadedCount}/${itemCount} produk · ${revisionCount} versi` : uploadedCount > 0 ? `${revisionCount} versi` : "Belum ada file";
  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <Badge variant={complete ? "success" : "warning"}>{label}</Badge>
      <span className={cn("text-xs text-muted-foreground", captionClassName)}>{caption}</span>
    </div>
  );
}
