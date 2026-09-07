"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { NewLeadForm } from "@/components/crm/new-lead-form";
import { PipelineSummary } from "@/components/crm/pipeline-summary";

const PipelineBoard = dynamic(
  () => import("@/components/crm/pipeline-board").then((m) => ({ default: m.PipelineBoard })),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);
import type { PipelineOpportunity } from "@/lib/crm/data";
import type { AppRole } from "@prisma/client";

type PipelineData = {
  opportunities: PipelineOpportunity[];
  total: number;
  truncated: boolean;
  actorRole: AppRole;
};

type CustomerOption = { id: string; customerNo: string; name: string; companyName: string | null };
type FormOptions = { customerTypes: Array<{ id: string; name: string }>; leadSources: Array<{ id: string; name: string }>; salesUsers: Array<{ id: string; name: string }> };

export function PipelineBoardSectionClient({
  initialData,
  initialCustomers,
  initialFormOptions,
}: {
  initialData: PipelineData;
  initialCustomers: CustomerOption[];
  initialFormOptions: FormOptions;
}) {
  const { data } = useSWR<PipelineData>("/api/crm/pipeline", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
    dedupingInterval: 10000,
  });

  const pipeline = data ?? initialData;

  return (
    <>
      {pipeline.actorRole === "ADMIN" || pipeline.actorRole === "SALES" ? (
        <div className="flex justify-end">
          <NewLeadForm customers={initialCustomers} {...initialFormOptions} />
        </div>
      ) : null}

      <PipelineSummary opportunities={pipeline.opportunities} total={pipeline.total} />

      {pipeline.truncated ? (
        <Alert>
          <AlertTitle>Board menampilkan 500 peluang terbaru</AlertTitle>
          <AlertDescription>Gunakan halaman customer untuk menelusuri data lama.</AlertDescription>
        </Alert>
      ) : null}

      <PipelineBoard opportunities={pipeline.opportunities} actorRole={pipeline.actorRole} />
    </>
  );
}
