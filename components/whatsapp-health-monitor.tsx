"use client";

import type { AppRole } from "@prisma/client";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { classifyWhatsAppHealthBanner, whatsappHealthChanged, type WhatsAppHealthState } from "@/lib/whatsapp/health";

type Health = {
  state: WhatsAppHealthState;
  account: { label: string; status: string; heartbeatAt: string | null; lastError: string | null } | null;
  ownJobs: { id: string; status: string; updatedAt: string; error: string | null }[];
  failedCount: number;
};

const stateCopy: Record<Exclude<WhatsAppHealthState, "HEALTHY">, string> = {
  NOT_CONFIGURED: "Belum ada nomor WhatsApp aktif.",
  WORKER_OFFLINE: "Worker WhatsApp tidak memberi heartbeat.",
  DISCONNECTED: "Nomor WhatsApp terputus.",
  LOGGED_OUT: "Nomor WhatsApp telah logout dan perlu dipasangkan ulang.",
  ERROR: "Integrasi WhatsApp mengalami kendala.",
};

export function WhatsAppHealthMonitor({ role }: { role: AppRole }) {
  const [health, setHealth] = useState<Health | null>(null);
  const manager = ["OWNER", "ADMIN", "ADMIN_CUSTOMER"].includes(role);

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
        const previousState = sessionStorage.getItem("whatsapp-health-state") as WhatsAppHealthState | null;
        if (whatsappHealthChanged(previousState, next.state)) {
          const healthy = next.state === "HEALTHY";
          toast.add({ title: healthy ? "WhatsApp kembali aktif" : "Koneksi WhatsApp berubah", description: healthy ? "Koneksi dan worker kembali normal." : stateCopy[next.state as Exclude<WhatsAppHealthState, "HEALTHY">], type: healthy ? "success" : "error" });
        }
        sessionStorage.setItem("whatsapp-health-state", next.state);
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
        setHealth(next);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("WhatsApp health poll failed");
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      void poll();
      timer = setTimeout(schedule, 3_000);
    }

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  const banner = health ? classifyWhatsAppHealthBanner(health.state, health.failedCount) : null;
  if (!health || !banner) return null;
  const description = health.state !== "HEALTHY"
    ? stateCopy[health.state]
    : `${health.failedCount} job WhatsApp gagal dan masih memerlukan tindakan.`;

  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>WhatsApp perlu perhatian</AlertTitle>
      <AlertDescription>
        {description}{manager && health.account?.lastError ? ` ${health.account.lastError}` : ""}{" "}
        {manager ? <Link href={banner === "FAILED_JOBS" ? "/whatsapp/jobs?status=FAILED" : "/master-data/whatsapp/accounts"}>{banner === "FAILED_JOBS" ? "Cek status pengiriman" : "Buka account WhatsApp"}</Link> : "Hubungi admin untuk pemeriksaan."}
      </AlertDescription>
    </Alert>
  );
}
