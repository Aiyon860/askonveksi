"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";

type Deletion = { id: string; label: string };

// ponytail: poll 5 dtk, toast saat id yang pernah terlihat hilang = job selesai.
// User yang menutup halaman tak dapat toast; buktinya card sudah hilang saat kembali.
export function WhatsAppDeletionMonitor({ active }: { active: boolean }) {
  const router = useRouter();
  const seenRef = useRef(new Map<string, string>());

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;

    async function poll() {
      if (document.visibilityState !== "visible" || aborted) return;
      try {
        const response = await fetch("/api/whatsapp/deletions", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { pending: Deletion[] };
        const current = new Map(data.pending.map((item) => [item.id, item.label]));
        for (const [id, label] of seenRef.current) {
          if (!current.has(id)) {
            seenRef.current.delete(id);
            toast.add({ title: "Penghapusan selesai", description: `Nomor ${label} beserta riwayat chat-nya sudah dihapus.`, type: "success" });
            router.refresh();
          }
        }
        for (const [id, label] of current) seenRef.current.set(id, label);
      } catch {
        // Poll gagal = abaikan, coba lagi interval berikut.
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === "visible" && !aborted) {
        void poll();
        timer = setTimeout(schedule, 5_000);
      }
    }

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [active, router]);

  return null;
}
