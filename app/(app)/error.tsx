"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Jaring pengaman area aplikasi: kegagalan tak terduga tampil sebagai halaman
 * ramah, bukan error bawaan Next. Penolakan akses tetap ditangani
 * `forbidden.tsx` (403), jadi halaman ini tidak menyamar sebagai 403.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader title="Halaman tidak dapat dimuat" description="Data yang sudah tersimpan tidak terpengaruh." />
      <Empty className="min-h-80 border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon"><AlertCircle aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>Terjadi kendala saat memuat data</EmptyTitle>
          <EmptyDescription>Coba lagi. Bila masalah berulang, sampaikan waktu kejadiannya ke Developer.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button type="button" variant="outline" onClick={retry} className="h-11 sm:h-9">Coba lagi</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()} className="h-11 sm:h-9">Kembali</Button>
        </EmptyContent>
      </Empty>
    </>
  );
}
