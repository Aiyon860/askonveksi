import { LoadingPage, KanbanSkeleton, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductionLoading() {
  return (
    <LoadingPage label="Memuat kanban Produksi">
      <PageHeaderSkeleton />
      <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1" aria-hidden="true">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
      <KanbanSkeleton columns={2} cardsPerColumn={[4, 4]} columnMinWidth="20rem" />
    </LoadingPage>
  );
}
