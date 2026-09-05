"use client";

import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ProductionError({ reset }: { error: Error; reset: () => void }) {
  return <><PageHeader title="Produksi" description="Pantau setiap Sales Order dari tahap pertama sampai selesai." /><Empty className="min-h-80 border bg-card"><EmptyHeader><EmptyMedia variant="icon"><AlertCircle aria-hidden="true" /></EmptyMedia><EmptyTitle>Produksi belum dapat dimuat</EmptyTitle><EmptyDescription>Coba muat ulang. Progres yang sudah tersimpan tidak terpengaruh.</EmptyDescription></EmptyHeader><Button type="button" variant="outline" onClick={reset}>Coba lagi</Button></Empty></>;
}
