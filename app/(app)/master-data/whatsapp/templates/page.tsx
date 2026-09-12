import { saveWhatsAppTemplateAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WHATSAPP_TEMPLATE_VARIABLES } from "@/lib/whatsapp/core";
import { getWhatsAppTemplates } from "@/lib/whatsapp/data";

const triggerLabels = {
  MANUAL: "Chat manual",
  NEXT_ACTION: "Tindak lanjut peluang",
  REACTIVATION: "Reminder order 6 bulanan",
  INVOICE_ISSUED: "Invoice diterbitkan",
  INVOICE_DUE: "Pengingat pembayaran",
} as const;

function TemplateForm({ template }: { template?: Awaited<ReturnType<typeof getWhatsAppTemplates>>[number] }) {
  const key = template?.id ?? "new";
  return (
    <form action={saveWhatsAppTemplateAction}>
      <input type="hidden" name="id" value={template?.id ?? ""} />
      <input type="hidden" name="version" value={template?.version ?? ""} />
      <FieldGroup className="gap-4">
        <Field><FieldLabel htmlFor={`name-${key}`}>Nama</FieldLabel><Input id={`name-${key}`} name="name" required maxLength={80} defaultValue={template?.name} /></Field>
        <Field>
          <FieldLabel htmlFor={`trigger-${key}`}>Pemicu</FieldLabel>
          <NativeSelect id={`trigger-${key}`} name="triggerType" defaultValue={template?.triggerType ?? "MANUAL"} className="w-full">
            {Object.entries(triggerLabels).map(([type, label]) => <NativeSelectOption key={type} value={type}>{label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`body-${key}`}>Isi pesan</FieldLabel>
          <Textarea id={`body-${key}`} name="body" required maxLength={4000} rows={6} defaultValue={template?.body} />
          <FieldDescription>Variabel: {WHATSAPP_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ")}</FieldDescription>
        </Field>
        <Field orientation="horizontal"><Switch id={`active-${key}`} name="isActive" defaultChecked={template?.isActive ?? true} /><FieldLabel htmlFor={`active-${key}`}>Aktif</FieldLabel></Field>
        <Button type="submit" className="self-end">Simpan template</Button>
      </FieldGroup>
    </form>
  );
}

export default async function WhatsAppTemplatesPage() {
  const templates = await getWhatsAppTemplates();
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Template chat" description="Kelola pesan cepat dan pesan otomatis WhatsApp." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Template baru</CardTitle><CardDescription>Template chat manual boleh aktif lebih dari satu.</CardDescription></CardHeader><CardContent><TemplateForm /></CardContent></Card>
        {templates.filter((template) => template.triggerType !== "REPEAT_ORDER").map((template) => (
          <Card key={template.id}><CardHeader><CardTitle>{template.name}</CardTitle><CardDescription>{triggerLabels[template.triggerType as keyof typeof triggerLabels]}</CardDescription></CardHeader><CardContent><TemplateForm template={template} /></CardContent></Card>
        ))}
      </div>
    </main>
  );
}
