"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader
        title="Dashboard sales"
        description="Ringkasan CRM yang perlu ditindaklanjuti hari ini."
      />
      <Empty className="min-h-80 border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon"><AlertCircle aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>Dashboard tidak dapat dimuat</EmptyTitle>
          <EmptyDescription>Coba muat ulang. Data CRM yang sudah tersimpan tidak terpengaruh.</EmptyDescription>
        </EmptyHeader>
        <Button type="button" variant="outline" onClick={retry} className="h-11 sm:h-9">
          Coba lagi
        </Button>
      </Empty>
    </>
  );
}
