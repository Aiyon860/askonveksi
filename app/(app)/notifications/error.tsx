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

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Pantau pembaruan pekerjaan dan tentukan mana yang masih perlu diperiksa."
      />
      <Empty className="min-h-80 border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon"><AlertCircle aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>Notifikasi tidak dapat dimuat</EmptyTitle>
          <EmptyDescription>Coba muat ulang halaman. Data lain di aplikasi tidak terpengaruh.</EmptyDescription>
        </EmptyHeader>
        <Button type="button" variant="outline" onClick={reset} className="h-11 sm:h-9">
          Coba lagi
        </Button>
      </Empty>
    </>
  );
}
