"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteWhatsAppTemplateAction, saveWhatsAppTemplateAction, toggleWhatsAppTemplateAction } from "@/app/actions/whatsapp";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { WHATSAPP_TEMPLATE_VARIABLES, WHATSAPP_TRIGGER_LABELS } from "@/lib/whatsapp/core";
import { cn } from "@/lib/utils";

export type TemplateRow = {
  id: string;
  name: string;
  triggerType: string;
  body: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
};

export const TRIGGER_LABELS: Record<string, string> = { ...WHATSAPP_TRIGGER_LABELS };

export function triggerLabel(triggerType: string) {
  return TRIGGER_LABELS[triggerType] ?? triggerType;
}

function TemplateFields({ idPrefix, template }: { idPrefix: string; template?: TemplateRow }) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`} required>Nama</FieldLabel>
        <Input id={`${idPrefix}-name`} name="name" required maxLength={80} defaultValue={template?.name} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-trigger`} required>Pemicu</FieldLabel>
        <NativeSelect id={`${idPrefix}-trigger`} name="triggerType" defaultValue={template?.triggerType ?? "MANUAL"} className="w-full">
          {Object.entries(TRIGGER_LABELS).map(([type, label]) => (
            <NativeSelectOption key={type} value={type}>{label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-body`} required>Isi pesan</FieldLabel>
        <Textarea id={`${idPrefix}-body`} name="body" required maxLength={4000} rows={6} defaultValue={template?.body} />
        <FieldDescription>Variabel: {WHATSAPP_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ")}</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <Switch id={`${idPrefix}-active`} name="isActive" defaultChecked={template?.isActive ?? true} />
        <FieldLabel htmlFor={`${idPrefix}-active`}>Aktif</FieldLabel>
      </Field>
    </FieldGroup>
  );
}

export function NewTemplateDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Tambah template
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah template</DialogTitle>
          <DialogDescription>Template chat manual boleh aktif lebih dari satu.</DialogDescription>
        </DialogHeader>
        <form action={saveWhatsAppTemplateAction}>
          <TemplateFields idPrefix="new-template" />
          <SubmitButton className="mt-6 w-full" pendingLabel="Menyimpan...">Simpan template</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateActiveSwitch({ template }: { template: TemplateRow }) {
  const [checked, setChecked] = useState(template.isActive);
  const [pending, startTransition] = useTransition();

  function onCheckedChange(next: boolean) {
    if (pending) return;
    setChecked(next);
    const formData = new FormData();
    formData.set("id", template.id);
    formData.set("version", String(template.version));
    formData.set("isActive", String(next));
    startTransition(async () => {
      await toggleWhatsAppTemplateAction(formData);
    });
  }

  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      {pending ? <Spinner className="text-muted-foreground" data-icon="inline-start" /> : null}
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={onCheckedChange}
        aria-label={template.isActive ? `Nonaktifkan template ${template.name}` : `Aktifkan template ${template.name}`}
      />
    </div>
  );
}

export function TemplateRowWithDialog({ template, number }: { template: TemplateRow; number: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setMode("view");
  }

  function openDetail() {
    setMode("view");
    setOpen(true);
  }

  return (
    <>
      <TableRow
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        onClick={openDetail}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetail();
          }
        }}
        className={cn("cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
      >
        <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{number}</TableCell>
        <TableCell className="font-medium">
          <span className="block max-w-56 truncate" title={template.name}>{template.name}</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{triggerLabel(template.triggerType)}</Badge>
        </TableCell>
        <TableCell>
          <TemplateActiveSwitch key={`${template.id}-${template.version}`} template={template} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {new Date(template.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
        </TableCell>
        <TableCell className="max-w-72">
          <span className="block truncate text-muted-foreground" title={template.body}>{template.body}</span>
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMode("edit");
                setOpen(true);
              }}
            >
              Edit
            </Button>
            <form action={deleteWhatsAppTemplateAction}>
              <input type="hidden" name="id" value={template.id} />
              <ConfirmSubmitButton
                variant="destructive"
                size="sm"
                pendingLabel="Menghapus..."
                confirmTitle="Hapus template?"
                confirmDescription={`Template "${template.name}" akan dihapus permanen dan tidak bisa dikembalikan.`}
                confirmLabel="Ya, hapus template"
              >
                Hapus
              </ConfirmSubmitButton>
            </form>
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {mode === "view" ? (
            <>
              <DialogHeader>
                <DialogTitle>{template.name}</DialogTitle>
                <DialogDescription>{triggerLabel(template.triggerType)}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={template.isActive ? "success" : "destructive"}>
                  {template.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Diperbarui {new Date(template.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">{template.body}</p>
              <p className="text-xs text-muted-foreground">
                Variabel: {WHATSAPP_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ")}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  Tutup
                </Button>
                <Button type="button" size="sm" onClick={() => setMode("edit")}>
                  <Pencil data-icon="inline-start" aria-hidden="true" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Edit template</DialogTitle>
                <DialogDescription>Perubahan langsung dipakai pesan berikutnya.</DialogDescription>
              </DialogHeader>
              <form action={saveWhatsAppTemplateAction}>
                <input type="hidden" name="id" value={template.id} />
                <input type="hidden" name="version" value={template.version} />
                <TemplateFields idPrefix={`edit-${template.id}`} template={template} />
                <div className="mt-6 flex items-center justify-between gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
                    Kembali ke detail
                  </Button>
                  <SubmitButton size="sm" pendingLabel="Menyimpan...">Simpan perubahan</SubmitButton>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
