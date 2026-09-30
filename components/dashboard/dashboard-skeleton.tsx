import { CardHeaderSkeleton, SectionHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH_SALES_SPANS } from "@/components/dashboard/dashboard-ui";
import { STAGE_SURFACE_CLASS } from "@/components/crm/stage-theme";
import { PIPELINE_STAGES } from "@/lib/crm/constants";
import { cn } from "@/lib/utils";

const accentTileClass = "dash-accent dash-panel flex h-full flex-col gap-4 rounded-xl border border-transparent p-4 sm:p-5";

/** Mengikuti kartu angka aslinya: label di atas, angka di tengah sisa tinggi. */
const tileValueClass = "flex flex-1 flex-col justify-center gap-2.5";

function StatTileSkeleton({ panel = "card", className }: { panel?: "card" | "tinted"; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-4 sm:p-5",
        panel === "tinted" ? "border-border bg-muted" : "dash-panel border-transparent bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <Skeleton className="h-4 w-24 max-w-full" />
      </div>
      <div className={tileValueClass}>
        <Skeleton className="h-7 w-28 max-w-full" />
        <Skeleton className="h-3 w-20 max-w-full" />
      </div>
    </div>
  );
}

/** Kartu aksen: label di atas, angka di tengah sisa tinggi seperti isi aslinya. */
function AccentTileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(accentTileClass, className)}>
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-10 shrink-0 rounded-xl bg-accent-surface-line" />
        <Skeleton className="h-4 w-24 max-w-full bg-accent-surface-line" />
      </div>
      <div className={tileValueClass}>
        <Skeleton className="h-7 w-32 max-w-full bg-accent-surface-line" />
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex min-h-20 items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="h-3 w-44 max-w-full" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("dash-panel rounded-xl border-0 bg-card", className)}>
      <CardHeaderSkeleton action />
      <CardContent>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/** Skeleton dashboard; dipakai jalur Suspense halaman maupun berkas loading rute. */
export function DashboardSkeleton() {
  return (
    <>
      <section aria-hidden="true">
        <div className="mb-4">
          <SectionHeaderSkeleton titleWidth="w-40" descriptionWidth="w-96 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <AccentTileSkeleton className={DASH_SALES_SPANS[0]} />
          {DASH_SALES_SPANS.slice(1).map((span, index) => (
            <StatTileSkeleton key={`sales-tile-${index}`} className={span} />
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <Card className="dash-panel rounded-xl border-0 bg-card">
          <CardHeaderSkeleton action />
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <AccentTileSkeleton />
            <StatTileSkeleton panel="tinted" />
          </CardContent>
        </Card>
      </section>

      <section aria-hidden="true">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton panel="tinted" className="sm:col-span-2 xl:col-span-1" />
        </div>
      </section>

      <section aria-hidden="true">
        <div className="mb-4">
          <SectionHeaderSkeleton titleWidth="w-32" descriptionWidth="w-80 max-w-full" />
        </div>
        <div className="grid gap-4 xl:grid-cols-5">
          <ChartCardSkeleton className="xl:col-span-3" />
          <ChartCardSkeleton className="xl:col-span-2" />
        </div>
      </section>

      <section aria-hidden="true">
        <div className="mb-4">
          <SectionHeaderSkeleton titleWidth="w-40" descriptionWidth="w-96 max-w-full" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, cardIndex) => (
            <Card key={`document-preview-${cardIndex}`} className="dash-panel rounded-xl border-0 bg-card">
              <CardHeaderSkeleton action />
              <CardContent className="gap-0">
                {Array.from({ length: 5 }, (_, rowIndex) => (
                  <ListRowSkeleton key={`document-row-${cardIndex}-${rowIndex}`} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <div className="mb-4">
          <SectionHeaderSkeleton titleWidth="w-28" descriptionWidth="w-64 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STAGES.map((stage, index) => (
            <div
              key={stage}
              /* Permukaan tahap diambil dari tema aslinya supaya warnanya tidak berubah saat data masuk. */
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-4",
                STAGE_SURFACE_CLASS[stage],
                index === PIPELINE_STAGES.length - 1 && "col-span-2 xl:col-span-1",
              )}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <Skeleton className="h-4 w-16 max-w-full" />
              </div>
              <div className={tileValueClass}>
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <Card className="dash-panel rounded-xl border-0 bg-card">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <CardAction><Skeleton className="h-6 w-20" /></CardAction>
          </CardHeader>
          <CardContent className="gap-0">
            {Array.from({ length: 5 }, (_, index) => (
              <ListRowSkeleton key={`next-action-${index}`} />
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
