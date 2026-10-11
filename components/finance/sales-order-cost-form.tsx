"use client";

import { Pencil } from "lucide-react";

import { updateSalesOrderCostAction } from "@/app/actions/finance";
import { MoneyInput } from "@/components/money-input";
import { PaymentProofPreview } from "@/components/payment-proof-preview";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/file-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const fields = [["kain", "Kain"], ["zipper", "Zipper"], ["jahit", "Jahit"], ["pres", "Pres"], ["dtfPlastisol", "DTF/Plastisol"], ["bordir", "Bordir"], ["lainnya", "Lain-lain"]] as const;

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export type HppProjectPrefill = { id: string; spentAt: string; paymentMethodId: string; proofPath: string | null; proofFileName: string | null; proofMimeType: string | null };

export function SalesOrderCostForm({ item, methods = [], projectExpenses = {} }: { item: { id: string; costVersion: number; kain: string | null; zipper: string | null; jahit: string | null; pres: string | null; dtfPlastisol: string | null; bordir: string | null; lainnya: string | null }; methods?: Array<{ id: string; name: string }>; projectExpenses?: Partial<Record<string, HppProjectPrefill>> }) {
  const today = jakartaToday();
  return <Dialog><DialogTrigger render={<Button size="sm" variant="outline" />}><Pencil data-icon="inline-start" aria-hidden="true" />Edit HPP</DialogTrigger><DialogContent className="max-h-[92svh] overflow-y-auto overflow-x-hidden sm:max-w-5xl"><DialogHeader><DialogTitle>Edit biaya HPP</DialogTitle><DialogDescription>Setiap biaya yang diisi nominalnya wajib dilengkapi tanggal bayar, metode, dan bukti TF masing-masing. Otomatis masuk ke Pengeluaran kategori Project. Gunakan 0 untuk biaya yang tidak digunakan. Bukti lama tetap dipakai bila tidak memilih file baru.</DialogDescription></DialogHeader><form action={updateSalesOrderCostAction}><input type="hidden" name="salesOrderId" value={item.id} /><input type="hidden" name="version" value={item.costVersion} /><FieldGroup>{fields.map(([name, label]) => {
    const old = projectExpenses[name];
    return <div key={name} className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4 [&>*]:min-w-0 [&_input]:min-w-0 [&_select]:min-w-0 [&_button]:min-w-0">
        <Field><FieldLabel htmlFor={`${name}-${item.id}`} required>Nominal (Rp)</FieldLabel><MoneyInput id={`${name}-${item.id}`} name={name} min="0" step="0.01" required defaultValue={item[name] ?? "0"} /></Field>
        <Field><FieldLabel htmlFor={`expense-date-${name}-${item.id}`}>Tanggal bayar</FieldLabel><Input id={`expense-date-${name}-${item.id}`} name={`expenseSpentAt${name.charAt(0).toUpperCase()}${name.slice(1)}`} type="date" defaultValue={old?.spentAt ?? today} /></Field>
        <Field><FieldLabel htmlFor={`expense-method-${name}-${item.id}`}>Metode</FieldLabel><NativeSelect id={`expense-method-${name}-${item.id}`} name={`expenseMethod${name.charAt(0).toUpperCase()}${name.slice(1)}`} defaultValue={old?.paymentMethodId ?? ""} className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{methods.map((m) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}</NativeSelect></Field>
        <Field><FieldLabel>Bukti TF</FieldLabel><FilePicker suppliedId={`expense-proof-${name}-${item.id}`} name={`expenseProof_${name}`} />{old?.proofPath ? <div className="mt-1 flex flex-col gap-1"><PaymentProofPreview href={`/api/keuangan/pengeluaran/${old.id}/bukti`} mimeType={old.proofMimeType} label={`Bukti ${label} sebelumnya`} /><p className="text-xs text-muted-foreground">Bukti lama dipakai bila tidak pilih file baru.</p></div> : null}</Field>
      </div>
    </div>;
  })}<SubmitButton pendingLabel="Menyimpan...">Simpan HPP</SubmitButton></FieldGroup></form></DialogContent></Dialog>;
}
