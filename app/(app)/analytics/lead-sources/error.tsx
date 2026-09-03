"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function LeadSourceRevenueError({ reset }: { reset: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><AlertCircle aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>Laporan tidak dapat dimuat</EmptyTitle>
        <EmptyDescription>Coba muat ulang. Jika masalah berlanjut, periksa koneksi database.</EmptyDescription>
      </EmptyHeader>
      <Button type="button" variant="outline" onClick={reset}>Coba lagi</Button>
    </Empty>
  );
}
