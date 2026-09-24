"use client";

import { Pencil } from "lucide-react";

import { updateSalesOrderCostAction } from "@/app/actions/finance";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const fields = [["kain", "Kain"], ["zipper", "Zipper"], ["jahit", "Jahit"], ["pres", "Pres"], ["dtfPlastisol", "DTF/Plastisol"], ["bordir", "Bordir"], ["lainnya", "Lain-lain"]] as const;

export function SalesOrderCostForm({ item }: { item: { id: string; costVersion: number; kain: string | null; zipper: string | null; jahit: string | null; pres: string | null; dtfPlastisol: string | null; bordir: string | null; lainnya: string | null } }) {
  return <Dialog><DialogTrigger render={<Button size="sm" variant="outline" />}><Pencil data-icon="inline-start" aria-hidden="true" />Edit HPP</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit biaya HPP</DialogTitle><DialogDescription>Isi semua biaya, gunakan Rp0 untuk biaya yang tidak digunakan.</DialogDescription></DialogHeader><form action={updateSalesOrderCostAction}><input type="hidden" name="salesOrderId" value={item.id} /><input type="hidden" name="version" value={item.costVersion} /><FieldGroup>{fields.map(([name, label]) => <Field key={name}><FieldLabel htmlFor={`${name}-${item.id}`} required>{label}</FieldLabel><Input id={`${name}-${item.id}`} name={name} type="number" min="0" step="0.01" required defaultValue={item[name] ?? "0"} /></Field>)}<SubmitButton pendingLabel="Menyimpan...">Simpan HPP</SubmitButton></FieldGroup></form></DialogContent></Dialog>;
}
