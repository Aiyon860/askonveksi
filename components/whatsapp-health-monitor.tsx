"use client";

import { useEffect } from "react";

import { toast } from "@/components/ui/toast";

type Health = {
  ownJobs: { id: string; status: string; updatedAt: string; error: string | null }[];
};

/**
 * Memberi tahu hasil pengiriman manual milik pengguna yang sedang login.
 * Status koneksi nomor tidak lagi tampil di sini; status itu hidup di judul
 * menu WhatsApp pada navigasi.
 */
export function WhatsAppHealthMonitor() {
  useEffect(() => {
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/whatsapp/health", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const next = await response.json() as Health;
        for (const job of next.ownJobs) {
          const key = `whatsapp-job-${job.id}`;
          const previous = sessionStorage.getItem(key);
          const terminal = job.status === "COMPLETED" || job.status === "FAILED";
          const recent = Date.now() - new Date(job.updatedAt).getTime() < 30_000;
          if (terminal && ((previous && previous !== job.status) || (!previous && recent))) {
            toast.add({ title: job.status === "COMPLETED" ? "Pesan WhatsApp terkirim" : "Pesan WhatsApp gagal", description: job.status === "COMPLETED" ? "Pesan manual selesai dikirim." : job.error ?? "Pengiriman gagal.", type: job.status === "COMPLETED" ? "success" : "error" });
          }
          sessionStorage.setItem(key, job.status);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("WhatsApp delivery poll failed");
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (document.visibilityState !== "visible") {
        controller?.abort();
        return;
      }
      void poll().finally(() => {
        if (document.visibilityState === "visible") timer = setTimeout(schedule, 10_000);
      });
    }

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  return null;
}
