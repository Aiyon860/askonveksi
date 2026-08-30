"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Status = { tone: "success" | "destructive"; message: string } | null;

export function PublicLeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionKeyRef = useRef<string>(crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionKey: submissionKeyRef.current }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "Lead belum dapat dikirim.");
      setStatus({ tone: "success", message: body.message || "Terima kasih. Tim Askonveksi akan menghubungi Anda." });
      formRef.current?.reset();
      submissionKeyRef.current = crypto.randomUUID();
    } catch (error) {
      setStatus({ tone: "destructive", message: error instanceof Error ? error.message : "Lead belum dapat dikirim. Silakan coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="rounded-xl border bg-card p-5 sm:p-6">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor="public-name" required>Nama</FieldLabel><Input id="public-name" name="name" required minLength={2} maxLength={160} autoComplete="name" /></Field>
          <Field><FieldLabel htmlFor="public-whatsapp" required>WhatsApp</FieldLabel><Input id="public-whatsapp" name="whatsapp" required minLength={8} maxLength={32} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" /></Field>
          <Field><FieldLabel htmlFor="public-product" required>Produk yang dibutuhkan</FieldLabel><Input id="public-product" name="productName" required minLength={2} maxLength={120} placeholder="Jersey, PDH, kaos, atau lainnya" /></Field>
          <Field><FieldLabel htmlFor="public-quantity">Perkiraan jumlah</FieldLabel><Input id="public-quantity" name="estimatedQuantity" type="number" min={1} max={10000000} step={1} /></Field>
          <Field><FieldLabel htmlFor="public-deadline">Deadline</FieldLabel><Input id="public-deadline" name="deadline" type="date" /></Field>
          <Field><FieldLabel htmlFor="public-city">Kota</FieldLabel><Input id="public-city" name="city" maxLength={120} autoComplete="address-level2" /></Field>
        </div>
        <Field className="absolute -left-[10000px] size-px overflow-hidden" aria-hidden="true">
          <FieldLabel htmlFor="public-website">Website</FieldLabel>
          <Input id="public-website" name="website" tabIndex={-1} autoComplete="off" />
        </Field>
        <FieldDescription>Dengan mengirim formulir, Anda menyetujui data dipakai untuk menghubungi Anda terkait kebutuhan penawaran.</FieldDescription>
        {status ? <Alert variant={status.tone}><AlertTitle>{status.tone === "success" ? "Lead terkirim" : "Lead belum terkirim"}</AlertTitle><AlertDescription>{status.message}</AlertDescription></Alert> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" aria-hidden="true" />}
          {pending ? "Mengirim..." : "Kirim kebutuhan"}
        </Button>
      </FieldGroup>
    </form>
  );
}
