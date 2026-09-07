import { LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessProfileLoading() {
  return (
    <LoadingPage label="Memuat profil perusahaan">
      <PageHeaderSkeleton />
      <Card className="max-w-3xl">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full sm:col-span-2" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full sm:col-span-2" />
          </div>
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
