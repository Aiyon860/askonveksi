import { saveWhatsAppTemplateAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WHATSAPP_TEMPLATE_VARIABLES } from "@/lib/whatsapp/core";
import { getWhatsAppTemplates } from "@/lib/whatsapp/data";

const triggerTypes = ["MANUAL", "NEXT_ACTION", "REPEAT_ORDER", "REACTIVATION", "INVOICE_ISSUED", "INVOICE_DUE"] as const;

function TemplateForm({ template }: { template?: Awaited<ReturnType<typeof getWhatsAppTemplates>>[number] }) {
  return <form action={saveWhatsAppTemplateAction}><input type="hidden" name="id" value={template?.id ?? ""} /><input type="hidden" name="version" value={template?.version ?? ""} /><FieldGroup className="gap-4"><Field><FieldLabel htmlFor={`name-${template?.id ?? "new"}`}>Nama</FieldLabel><Input id={`name-${template?.id ?? "new"}`} name="name" required maxLength={80} defaultValue={template?.name} /></Field><Field><FieldLabel htmlFor={`trigger-${template?.id ?? "new"}`}>Pemicu</FieldLabel><NativeSelect id={`trigger-${template?.id ?? "new"}`} name="triggerType" defaultValue={template?.triggerType ?? "MANUAL"} className="w-full">{triggerTypes.map((type) => <NativeSelectOption key={type} value={type}>{type.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`body-${template?.id ?? "new"}`}>Isi pesan</FieldLabel><Textarea id={`body-${template?.id ?? "new"}`} name="body" required maxLength={4000} rows={5} defaultValue={template?.body} /><FieldDescription>Variabel: {WHATSAPP_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ")}</FieldDescription></Field><Field orientation="horizontal"><input id={`active-${template?.id ?? "new"}`} type="checkbox" name="isActive" defaultChecked={template?.isActive ?? true} className="size-4" /><FieldLabel htmlFor={`active-${template?.id ?? "new"}`}>Aktif</FieldLabel></Field><Button type="submit" className="self-end">Simpan template</Button></FieldGroup></form>;
}

export default async function WhatsAppTemplatesPage() {
  const templates = await getWhatsAppTemplates();
  return <main className="flex flex-col gap-6"><PageHeader title="Template WhatsApp" description="Kelola teks standar untuk chat manual, follow-up, repeat order, dan invoice." /><div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Template baru</CardTitle><CardDescription>Buat satu template untuk pemicu yang dibutuhkan.</CardDescription></CardHeader><CardContent><TemplateForm /></CardContent></Card>{templates.map((template) => <Card key={template.id}><CardHeader><CardTitle>{template.name}</CardTitle><CardDescription>{template.triggerType.replaceAll("_", " ")}</CardDescription></CardHeader><CardContent><TemplateForm template={template} /></CardContent></Card>)}</div></main>;
}
