import { updateFollowUpSettingsAction } from "@/app/actions/follow-up-settings";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { RepeatOrderPatternForm } from "@/components/settings/repeat-order-pattern-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getFollowUpSettings } from "@/lib/crm/follow-up-settings";

export default async function SettingsPage() {
  const settings = await getFollowUpSettings();
  return <main className="flex max-w-3xl flex-col gap-6">
    <PageHeader title="Pengaturan" description="Atur jadwal pengingat otomatis untuk customer dan pembayaran." />
    <PageMessage />
    <Card><CardHeader><CardTitle>Reminder repeat order</CardTitle><CardDescription>Jeda bulan diulang dari awal setelah jeda terakhir. Pola 6, 5 berarti bulan ke-6, 11, 17, 22, dan seterusnya dari order terakhir.</CardDescription></CardHeader><CardContent><RepeatOrderPatternForm intervals={settings.repeatOrderIntervals} version={settings.version} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Pengingat pembayaran</CardTitle><CardDescription>Nilai negatif berarti sebelum deadline, 0 tepat pada deadline, dan nilai positif setelah deadline.</CardDescription></CardHeader><CardContent>
      <form action={updateFollowUpSettingsAction}><input type="hidden" name="version" value={settings.version} /><FieldGroup>
        {settings.invoiceReminderOffsets.map((offset, index) => <Field key={`${index}-${offset}`}><FieldLabel htmlFor={`offset-${index}`}>Pengingat {index + 1}</FieldLabel><Input id={`offset-${index}`} name="offset" type="number" required min={-365} max={365} step={1} defaultValue={offset} /><FieldDescription>Satuan hari dari deadline pembayaran.</FieldDescription></Field>)}
        <SubmitButton className="self-end">Simpan pengingat</SubmitButton>
      </FieldGroup></form>
    </CardContent></Card>
  </main>;
}
