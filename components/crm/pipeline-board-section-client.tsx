"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RepeatOrderForm } from "@/components/crm/repeat-order-form";
import { PipelineSummary } from "@/components/crm/pipeline-summary";
import { CRM_OPERATOR_ROLES, hasRole } from "@/lib/auth/permissions";

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

type CustomerOption = { id: string; customerNo: string; name: string; companyName: string | null; whatsapp: string | null };

export function PipelineBoardSectionClient({
  initialData,
  initialCustomers,
}: {
  initialData: PipelineData;
  initialCustomers: CustomerOption[];
}) {
  const { data, mutate } = useSWR<PipelineData>("/api/crm/pipeline", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
    dedupingInterval: 10000,
  });

  // Data server (RSC) selalu paling baru setelah aksi + `router.refresh()`. Tanpa ini, cache SWR
  // menahan snapshot lama (mis. status PO/invoice pada kartu) sampai polling 60 detik berikutnya.
  useEffect(() => {
    void mutate(initialData, { revalidate: false });
  }, [initialData, mutate]);

  const pipeline = data ?? initialData;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PipelineSummary opportunities={pipeline.opportunities} total={pipeline.total} className="sm:flex-1" />
        {hasRole(pipeline.actorRole, CRM_OPERATOR_ROLES) ? (
          <div className="flex flex-wrap gap-2"><RepeatOrderForm customers={initialCustomers} /></div>
        ) : null}
      </div>

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
