"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { updateRepeatOrderSettingsAction } from "@/app/actions/follow-up-settings";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function RepeatOrderPatternForm({ intervals, version }: { intervals: number[]; version: number }) {
  const [rows, setRows] = useState(() => intervals.map((months, index) => ({ id: index, months: String(months) })));
  return <form action={updateRepeatOrderSettingsAction}>
    <input type="hidden" name="version" value={version} />
    <FieldGroup>
      {rows.map((row, index) => <Field key={row.id}>
        <FieldLabel htmlFor={`interval-${row.id}`}>Jeda {index + 1} (bulan)</FieldLabel>
        <div className="flex items-center gap-2">
          <Input id={`interval-${row.id}`} name="interval" type="number" min={1} max={120} step={1} required value={row.months} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, months: event.target.value } : item))} />
          <Button type="button" variant="ghost" size="icon" aria-label={`Hapus jeda ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 aria-hidden="true" /></Button>
        </div>
      </Field>)}
      <div className="flex justify-between gap-2">
        <Button type="button" size="sm" variant="outline" disabled={rows.length >= 24} onClick={() => setRows((current) => [...current, { id: Math.max(...current.map((item) => item.id)) + 1, months: "1" }])}><Plus data-icon="inline-start" aria-hidden="true" />Tambah jeda</Button>
        <SubmitButton>Simpan pola</SubmitButton>
      </div>
    </FieldGroup>
  </form>;
}
