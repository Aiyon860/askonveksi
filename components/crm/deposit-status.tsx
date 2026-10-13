import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

/**
 * Kolom Deposit pada tabel PO. PO yang checkbox Deposit-nya tidak dicentang
 * ditandai "Tanpa deposit" agar tidak terbaca sebagai deposit tertunggak.
 */
export function DepositStatus({
  paid,
  amount,
  required = true,
  className,
  captionClassName,
}: {
  paid: boolean;
  amount: string | number | null;
  required?: boolean;
  className?: string;
  captionClassName?: string;
}) {
  if (!required) {
    return (
      <div className={cn("flex flex-col items-start gap-1", className)}>
        <Badge variant="outline">Tanpa deposit</Badge>
        <span className={cn("text-xs text-muted-foreground", captionClassName)}>Tidak perlu deposit</span>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <Badge variant={paid ? "success" : "warning"}>{paid ? "Sudah Depo" : "Belum Depo"}</Badge>
      <span className={cn("text-xs text-muted-foreground", captionClassName)}>
        {paid ? formatCurrency(amount) : "Belum dibayar"}
      </span>
    </div>
  );
}
