"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { updateSalesOrderProductCostAction } from "@/app/actions/finance";
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

// Sinkron dengan HPP_ROW_LIMIT server; tombol tambah disembunyikan sebelum batas ini.
const HPP_ROW_LIMIT = 12;

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export type HppProjectPrefill = { id: string; spentAt: string; paymentMethodId: string; description: string | null; amount: string; proofPath: string | null; proofFileName: string | null; proofMimeType: string | null };

type RowState = { localId: number; id?: string; amount: string; description: string; spentAt: string; method: string; proofPath: string | null; proofFileName: string | null; proofMimeType: string | null };

type HppKey = (typeof fields)[number][0];

function blankRow(localId: number, today: string): RowState {
  return { localId, amount: "", description: "", spentAt: today, method: "", proofPath: null, proofFileName: null, proofMimeType: null };
}

function initialRows(projectExpenses: Partial<Record<HppKey, HppProjectPrefill[]>>, today: string, fallback: Partial<Record<HppKey, string | null>>) {
  let localId = 0;
  return Object.fromEntries(fields.map(([name]) => {
    const prefill = projectExpenses[name];
    const rows: RowState[] = (prefill ?? []).map((row) => ({ localId: localId++, id: row.id, amount: row.amount, description: row.description ?? "", spentAt: row.spentAt, method: row.paymentMethodId, proofPath: row.proofPath, proofFileName: row.proofFileName, proofMimeType: row.proofMimeType }));
    // Data lama bisa punya nilai agregat tanpa baris Expense. Tampilkan sebagai
    // baris baru agar menyimpan HPP tidak menghapus nilai tersebut diam-diam.
    if (!rows.length && fallback[name] && Number(fallback[name]) > 0) rows.push({ ...blankRow(localId++, today), amount: fallback[name] as string });
    if (!rows.length) rows.push(blankRow(localId++, today));
    return [name, rows] as const;
  })) as Record<HppKey, RowState[]>;
}

export function SalesOrderCostForm({ item, methods = [], projectExpenses = {} }: { item: { id: string; productCostId: string; productName: string; costVersion: number; kain: string | null; zipper: string | null; jahit: string | null; pres: string | null; dtfPlastisol: string | null; bordir: string | null; lainnya: string | null }; methods?: Array<{ id: string; name: string }>; projectExpenses?: Partial<Record<HppKey, HppProjectPrefill[]>> }) {
  const [rowsByKey, setRowsByKey] = useState(() => initialRows(projectExpenses, jakartaToday(), item));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [nextLocal, setNextLocal] = useState(() => fields.reduce((sum, [name]) => sum + (projectExpenses[name]?.length ?? 1), 0));
  const patchRow = (key: HppKey, localId: number, patch: Partial<RowState>) => setRowsByKey((current) => ({ ...current, [key]: current[key].map((row) => row.localId === localId ? { ...row, ...patch } : row) }));
  const addRow = (key: HppKey) => { setRowsByKey((current) => ({ ...current, [key]: [...current[key], blankRow(nextLocal, jakartaToday())] })); setNextLocal((value) => value + 1); };
  const removeRow = (key: HppKey, localId: number) => {
    const removed = rowsByKey[key].find((row) => row.localId === localId);
    if (removed?.id) setRemovedIds((ids) => ids.includes(removed.id as string) ? ids : [...ids, removed.id as string]);
    setRowsByKey((current) => {
      const next = current[key].filter((row) => row.localId !== localId);
      if (!next.length) next.push(blankRow(nextLocal, jakartaToday()));
      return { ...current, [key]: next };
    });
  };
  return <Dialog><DialogTrigger render={<Button size="sm" variant="outline" />}><Pencil data-icon="inline-start" aria-hidden="true" />Edit HPP</DialogTrigger><DialogContent className="max-h-[92svh] overflow-y-auto overflow-x-hidden sm:max-w-5xl"><DialogHeader><DialogTitle>Edit HPP · {item.productName}</DialogTitle><DialogDescription>HPP ini hanya untuk produk <span className="font-medium text-foreground">{item.productName}</span>. Isi HPP multi-baris: satu jenis boleh punya banyak baris. Nominal kosong diabaikan. Tanggal dan metode wajib untuk baris ber-nominal; bukti TF opsional. Baris yang dikosongkan atau dihapus masuk Riwayat Hapus; baris yang diubah ditimpa di tempat. Otomatis masuk ke Pengeluaran kategori Project.</DialogDescription></DialogHeader><form action={updateSalesOrderProductCostAction}><input type="hidden" name="productCostId" value={item.productCostId} /><input type="hidden" name="version" value={item.costVersion} />{removedIds.map((id) => <input key={id} type="hidden" name="removedId" value={id} />)}<FieldGroup>{fields.map(([name, label]) => {
    const key = name as HppKey;
    const list = rowsByKey[key];
    return <div key={name} className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {list.length < HPP_ROW_LIMIT ? <Button type="button" variant="ghost" size="sm" onClick={() => addRow(key)}><Plus data-icon="inline-start" aria-hidden="true" />Tambah baris</Button> : <span className="text-xs text-muted-foreground">Maksimal {HPP_ROW_LIMIT} baris</span>}
      </div>
      {list.map((row, index) => <div key={row.localId} className="flex flex-col gap-3 rounded-md border p-3 min-[720px]:flex-row min-[720px]:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4 [&>*]:min-w-0 [&_input]:min-w-0 [&_select]:min-w-0 [&_button]:min-w-0">
          {row.id ? <input type="hidden" name={`id_${name}_${index}`} value={row.id} /> : null}
          <Field><FieldLabel htmlFor={`amount-${name}-${row.localId}`}>Nominal (Rp)</FieldLabel><MoneyInput id={`amount-${name}-${row.localId}`} name={`amount_${name}_${index}`} min="0" step="0.01" value={row.amount} onChange={(event) => patchRow(key, row.localId, { amount: (event.target as { value?: string }).value ?? "" })} /></Field>
          <Field><FieldLabel htmlFor={`description-${name}-${row.localId}`}>Deskripsi</FieldLabel><Input id={`description-${name}-${row.localId}`} name={`description_${name}_${index}`} maxLength={240} value={row.description} onChange={(event) => patchRow(key, row.localId, { description: event.target.value })} placeholder={`Catatan ${label.toLowerCase()} opsional`} /></Field>
          <Field><FieldLabel htmlFor={`date-${name}-${row.localId}`}>Tanggal bayar</FieldLabel><Input id={`date-${name}-${row.localId}`} name={`spentAt_${name}_${index}`} type="date" value={row.spentAt} onChange={(event) => patchRow(key, row.localId, { spentAt: event.target.value })} /></Field>
          <Field><FieldLabel htmlFor={`method-${name}-${row.localId}`}>Metode</FieldLabel><NativeSelect id={`method-${name}-${row.localId}`} name={`method_${name}_${index}`} value={row.method} onChange={(event) => patchRow(key, row.localId, { method: event.target.value })} className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{methods.map((m) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}</NativeSelect></Field>
          <div className="min-[1100px]:col-span-4"><Field><FieldLabel>Bukti TF (opsional)</FieldLabel><FilePicker suppliedId={`proof-${name}-${row.localId}`} name={`proof_${name}_${index}`} />{row.proofPath ? <div className="mt-1 flex flex-col gap-1"><PaymentProofPreview href={`/api/keuangan/pengeluaran/${row.id}/bukti`} mimeType={row.proofMimeType} label={`Bukti ${label} baris ${index + 1}`} /><p className="text-xs text-muted-foreground">Bukti lama tetap dipakai bila tidak memilih file baru.</p></div> : null}</Field></div>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label={`Hapus baris ${label} ${index + 1}`} onClick={() => removeRow(key, row.localId)}><Trash2 data-icon="inline-start" aria-hidden="true" />Hapus</Button>
      </div>)}
    </div>;
  })}<SubmitButton pendingLabel="Menyimpan...">Simpan HPP</SubmitButton></FieldGroup></form></DialogContent></Dialog>;
}
