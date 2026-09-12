import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsAppLoading() {
  return <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]"><Skeleton className="h-[620px]" /><Skeleton className="h-[620px]" /></div>;
}

