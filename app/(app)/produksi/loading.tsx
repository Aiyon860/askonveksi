import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductionLoading() {
  return <LoadingPage label="Memuat kanban Produksi"><PageHeaderSkeleton /><Skeleton className="h-9 w-48" /><Skeleton className="h-96 w-full" /></LoadingPage>;
}
