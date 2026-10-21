"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { restoreContentAction } from "@/lib/cms/actions";

export function RestoreVersionButton({
  file,
  version,
  size = "sm",
}: {
  file: string;
  version: number;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!window.confirm(`Pulihkan versi ${version}? Isi website saat ini akan dibuatkan cadangan, lalu diganti dengan versi tersebut.`)) return;
    setPending(true);
    setError(null);
    const result = await restoreContentAction(file);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/cms/riwayat?restored=1");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size={size} variant="outline" onClick={() => void restore()} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
        {pending ? "Memulihkan…" : "Pulihkan"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
