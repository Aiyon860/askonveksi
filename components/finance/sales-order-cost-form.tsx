"use client";

import { Pencil } from "lucide-react";

import { updateSalesOrderCostAction } from "@/app/actions/finance";
import { MoneyInput } from "@/components/money-input";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FilePicker } from "@/components/file-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const fields = [["kain", "Kain"], ["zipper", "Zipper"], ["jahit", "Jahit"], ["pres", "Pres"], ["dtfPlastisol", "DTF/Plastisol"], ["bordir", "Bordir"], ["lainnya", "Lain-lain"]] as const;

export function SalesOrderCostForm({ item, methods = [] }: { item: { id: string; costVersion: number; kain: string | null; zipper: string | null; jahit: string | null; pres: string | null; dtfPlastisol: string | null; bordir: string | null; lainnya: string | null }; methods?: Array<{ id: string; name: string }> }) {
  return <Dialog><DialogTrigger render={<Button size="sm" variant="outline" />}><Pencil data-icon="inline-start" aria-hidden="true" />Edit HPP</DialogTrigger><DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit biaya HPP</DialogTitle><DialogDescription>Isi semua biaya; gunakan 0 untuk biaya yang tidak digunakan. Centang sinkronisasi agar otomatis masuk ke Pengeluaran kategori Project.</DialogDescription></DialogHeader><form action={updateSalesOrderCostAction}><input type="hidden" name="salesOrderId" value={item.id} /><input type="hidden" name="version" value={item.costVersion} /><FieldGroup>{fields.map(([name, label]) => <Field key={name}><FieldLabel htmlFor={`${name}-${item.id}`} required>{label}</FieldLabel><MoneyInput id={`${name}-${item.id}`} name={name} min="0" step="0.01" required defaultValue={item[name] ?? "0"} /></Field>)}<Field><div className="flex items-center gap-2"><Checkbox id={`sync-${item.id}`} name="syncToExpense" value="on" /><FieldLabel htmlFor={`sync-${item.id}`}>Masuk ke Pengeluaran (kategori Project)</FieldLabel></div></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor={`expense-date-${item.id}`}>Tanggal pengeluaran</FieldLabel><Input id={`expense-date-${item.id}`} name="expenseSpentAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field><FieldLabel htmlFor={`expense-method-${item.id}`}>Metode pembayaran</FieldLabel><NativeSelect id={`expense-method-${item.id}`} name="expensePaymentMethodId" defaultValue="" className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{methods.map((m) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}</NativeSelect></Field></div><Field><FieldLabel>Bukti TF</FieldLabel><FilePicker suppliedId={`expense-proof-${item.id}`} name="expenseProof" /><p className="text-xs text-muted-foreground">Wajib jika sinkronisasi dicentang. Satu bukti dipakai untuk semua item HPP.</p></Field><SubmitButton pendingLabel="Menyimpan...">Simpan HPP</SubmitButton></FieldGroup></form></DialogContent></Dialog>;
}
