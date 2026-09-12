"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type WhatsAppPairingCodeProps = {
  code: string | null;
  expiresAt: string | null;
  waiting: boolean;
};

export function WhatsAppPairingCode({ code, expiresAt, waiting }: WhatsAppPairingCodeProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!code || !expiresAt) return;

    const updateRemaining = () => {
      setRemaining(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000)));
    };
    const timeout = window.setTimeout(updateRemaining, 0);
    const interval = window.setInterval(updateRemaining, 1_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [code, expiresAt]);

  if (!code || !expiresAt) {
    return waiting ? (
      <div className="space-y-1 text-sm text-muted-foreground" role="status">
        <p className="flex items-center gap-2"><Spinner />Menunggu kode dari worker...</p>
        <p className="text-xs">Biasanya kode muncul dalam beberapa detik. Pastikan satu worker WhatsApp sedang aktif.</p>
      </div>
    ) : null;
  }

  return (
    <div className="rounded-md border bg-muted p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <code className="font-mono text-lg font-semibold">{remaining === 0 ? "Kode kedaluwarsa" : code}</code>
        <Badge variant={remaining === 0 ? "destructive" : "outline"}>
          {remaining === null ? "Menghitung..." : remaining ? `${remaining} detik` : "Kedaluwarsa"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {remaining === 0 ? "Kode hanya berlaku sekali. Klik Pairing untuk meminta kode baru." : "Masukkan kode ini di WhatsApp sebelum waktunya habis. Jika kedaluwarsa, klik Pairing lagi."}
      </p>
    </div>
  );
}
