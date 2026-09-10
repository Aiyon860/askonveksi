"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WhatsAppAutoRefresh({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !pending) {
        startTransition(() => router.refresh());
      }
    }, 3_000);

    return () => window.clearInterval(interval);
  }, [enabled, pending, router]);

  return null;
}
