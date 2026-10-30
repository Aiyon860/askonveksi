"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { ListFilter, RotateCcw } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { RepeatOrderForm } from "@/components/crm/repeat-order-form";
import { PipelineFiltersBar, type PipelineCategoryOption, type PipelineCustomerOption } from "@/components/crm/pipeline-filters";
import { PipelineSummary } from "@/components/crm/pipeline-summary";
import {
  EMPTY_PIPELINE_FILTERS,
  NO_PRODUCT_CATEGORY,
  filterPipelineOpportunities,
  formatPipelineMonth,
  hasActivePipelineFilters,
  type PipelineFilters,
} from "@/lib/crm/pipeline-filters";
import { CRM_OPERATOR_ROLES, hasRole } from "@/lib/auth/permissions";
import { PIPELINE_STAGES } from "@/lib/crm/constants";

const PipelineBoard = dynamic(
  () => import("@/components/crm/pipeline-board").then((m) => ({ default: m.PipelineBoard })),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);
import type { PipelineOpportunity } from "@/lib/crm/data";
import type { AppRole, OpportunityStage } from "@prisma/client";

type PipelineData = {
  opportunities: PipelineOpportunity[];
  total: number;
  truncated: boolean;
  actorRole: AppRole;
};

type CustomerOption = { id: string; customerNo: string; name: string; companyName: string | null; whatsapp: string | null };

// Papan hanya punya empat kolom; peluang tahap Prospek tidak pernah tampil di sini.
const BOARD_STAGES = new Set<OpportunityStage>(PIPELINE_STAGES);

export function PipelineBoardSectionClient({
  initialData,
  initialCustomers,
  initialCategories,
}: {
  initialData: PipelineData;
  initialCustomers: CustomerOption[];
  initialCategories: PipelineCategoryOption[];
}) {
  const { data, mutate } = useSWR<PipelineData>("/api/crm/pipeline", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
    dedupingInterval: 10000,
  });
  const [filters, setFilters] = useState<PipelineFilters>(EMPTY_PIPELINE_FILTERS);
  const [filterResetKey, setFilterResetKey] = useState(0);

  // Data server (RSC) selalu paling baru setelah aksi + `router.refresh()`. Tanpa ini, cache SWR
  // menahan snapshot lama (mis. status PO/invoice pada kartu) sampai polling 60 detik berikutnya.
  useEffect(() => {
    void mutate(initialData, { revalidate: false });
  }, [initialData, mutate]);

  const pipeline = data ?? initialData;
  const isFiltering = hasActivePipelineFilters(filters);

  // Opsi customer diambil dari kartu yang termuat supaya setiap pilihan pasti punya peluang.
  const customerOptions = useMemo(() => {
    const byId = new Map<string, PipelineCustomerOption>();
    for (const opportunity of pipeline.opportunities) {
      if (!byId.has(opportunity.customer.id)) {
        byId.set(opportunity.customer.id, {
          id: opportunity.customer.id,
          name: opportunity.customer.name,
          customerNo: opportunity.customer.customerNo,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [pipeline.opportunities]);

  const filteredOpportunities = useMemo(
    () => filterPipelineOpportunities(pipeline.opportunities, filters),
    [pipeline.opportunities, filters],
  );

  const visibleCount = useMemo(
    () => filteredOpportunities.reduce((count, opportunity) => count + (BOARD_STAGES.has(opportunity.stage) ? 1 : 0), 0),
    [filteredOpportunities],
  );

  // Alasan board kosong harus kelihatan: filter yang aktif disebut satu per satu.
  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (filters.month) labels.push(formatPipelineMonth(filters.month));
    if (filters.customerId) {
      const customer = customerOptions.find((option) => option.id === filters.customerId);
      if (customer) labels.push(customer.name);
    }
    if (filters.categoryId) {
      const category = filters.categoryId === NO_PRODUCT_CATEGORY
        ? "Tanpa kategori"
        : initialCategories.find((option) => option.id === filters.categoryId)?.name;
      if (category) labels.push(category);
    }
    return labels;
  }, [customerOptions, filters, initialCategories]);

  function updateFilters(patch: Partial<PipelineFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters(EMPTY_PIPELINE_FILTERS);
    setFilterResetKey((key) => key + 1);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PipelineSummary
            opportunities={filteredOpportunities}
            total={isFiltering ? visibleCount : pipeline.total}
            grandTotal={isFiltering ? pipeline.total : undefined}
            className="sm:flex-1"
          />
          {hasRole(pipeline.actorRole, CRM_OPERATOR_ROLES) ? (
            <div className="flex flex-wrap gap-2"><RepeatOrderForm customers={initialCustomers} /></div>
          ) : null}
        </div>

        <PipelineFiltersBar
          filters={filters}
          customers={customerOptions}
          categories={initialCategories}
          active={isFiltering}
          resetKey={filterResetKey}
          onChange={updateFilters}
          onReset={resetFilters}
        />
        <p className="sr-only" aria-live="polite">
          {isFiltering ? `${visibleCount} dari ${pipeline.total} peluang ditampilkan.` : ""}
        </p>
      </div>

      {pipeline.truncated ? (
        <Alert>
          <AlertTitle>Board menampilkan 500 peluang terbaru</AlertTitle>
          <AlertDescription>
            {isFiltering ? "Filter hanya berlaku pada peluang yang termuat di board. " : null}
            Gunakan halaman customer untuk menelusuri data lama.
          </AlertDescription>
        </Alert>
      ) : null}

      {isFiltering && visibleCount === 0 ? (
        <Empty className="border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListFilter aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Tidak ada peluang yang cocok</EmptyTitle>
            <EmptyDescription>
              {activeFilterLabels.length
                ? `Tidak ada peluang untuk ${activeFilterLabels.join(" · ")}. Hapus salah satu filter atau reset untuk melihat peluang lain.`
                : "Ubah atau hapus filter untuk melihat peluang lain."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Reset filter
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <PipelineBoard opportunities={filteredOpportunities} actorRole={pipeline.actorRole} />
      )}
    </>
  );
}
