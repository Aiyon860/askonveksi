import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </>
  );
}
