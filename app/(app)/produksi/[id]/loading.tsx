import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductionDetailLoading() {
  return <LoadingPage label="Memuat detail Produksi"><PageHeaderSkeleton action /><Skeleton className="h-96 w-full" /></LoadingPage>;
}
