import Link from "next/link";

import { createCampaignAction, deleteCampaignAction, sendCampaignTestAction, updateCampaignAction } from "@/app/actions/campaigns";
import { CampaignEnabledSwitch } from "@/components/campaigns/campaign-enabled-switch";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { CAMPAIGN_VARIABLES, jakartaDateTimeInput } from "@/lib/whatsapp/campaigns";

const statusLabels = { SCHEDULED: "Terjadwal", PROCESSING: "Mengirim", PAUSED: "Dijeda", SKIPPED: "Dilewati", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" } as const;

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const actor = await requireActor(CRM_OPERATOR_ROLES);
  const canSendTest = actor.role === "DEVELOPER";
  const campaigns = await getPrismaClient().whatsAppCampaign.findMany({
    select: { id: true, name: true, body: true, scheduledAt: true, status: true, version: true, startedAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
  });
  const counts = campaigns.length ? await getPrismaClient().whatsAppAutomationJob.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
    _count: { _all: true },
  }) : [];
  const countByCampaign = new Map<string, Record<string, number>>();
  for (const item of counts) {
    if (!item.campaignId) continue;
    const current = countByCampaign.get(item.campaignId) ?? {};
    current[item.status] = item._count._all;
    countByCampaign.set(item.campaignId, current);
  }
  const requestedEdit = (await searchParams).edit;
  const edit = campaigns.find((item) => item.id === requestedEdit && (item.status === "SCHEDULED" || item.status === "PAUSED"));

  return (
    <main className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Campaign promo" description="Jadwalkan penawaran WhatsApp untuk seluruh customer dan prospek." />
      <PageMessage />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader><CardTitle>{edit ? "Edit campaign" : "Campaign baru"}</CardTitle></CardHeader>
          <CardContent>
            <form action={edit ? updateCampaignAction : createCampaignAction}>
              {edit ? <><input type="hidden" name="campaignId" value={edit.id} /><input type="hidden" name="version" value={edit.version} /></> : null}
              <FieldGroup>
                <Field><FieldLabel htmlFor="campaign-name">Nama campaign</FieldLabel><Input id="campaign-name" name="name" required minLength={2} maxLength={120} defaultValue={edit?.name ?? ""} /></Field>
                <Field><FieldLabel htmlFor="campaign-scheduled">Mulai kirim (WIB)</FieldLabel><Input id="campaign-scheduled" name="scheduledAt" type="datetime-local" required defaultValue={edit ? jakartaDateTimeInput(edit.scheduledAt) : ""} /></Field>
                <Field><FieldLabel htmlFor="campaign-body">Pesan WhatsApp</FieldLabel><Textarea id="campaign-body" name="body" required maxLength={4000} rows={7} defaultValue={edit?.body ?? ""} /><FieldDescription>Variabel: {CAMPAIGN_VARIABLES.map((name) => `{{${name}}}`).join(", ")}</FieldDescription></Field>
                {canSendTest ? <Field><FieldLabel htmlFor="campaign-test-phone">Nomor WhatsApp test</FieldLabel><Input id="campaign-test-phone" name="phoneNumber" inputMode="tel" maxLength={32} /><FieldDescription>Pesan dikirim hanya ke nomor ini memakai data contoh.</FieldDescription></Field> : null}
                <div className="flex justify-end gap-2">
                  {edit ? <Button variant="outline" render={<Link href="/campaigns" />} nativeButton={false}>Batal edit</Button> : null}
                  {canSendTest ? <SubmitButton formAction={sendCampaignTestAction} formNoValidate variant="outline" pendingLabel="Menjadwalkan test...">Kirim test</SubmitButton> : null}
                  <SubmitButton>{edit ? "Simpan perubahan" : "Jadwalkan campaign"}</SubmitButton>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <section className="min-w-0">
          <h2 className="mb-3 text-base font-semibold">Daftar campaign</h2>
          <Table containerClassName="min-w-0 rounded-md border">
            <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Mulai (WIB)</TableHead><TableHead>Status</TableHead><TableHead>Pengiriman</TableHead><TableHead className="text-right">Aktif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {campaigns.length ? campaigns.map((campaign) => {
                const count = countByCampaign.get(campaign.id) ?? {};
                const sent = count.COMPLETED ?? 0;
                const failed = count.FAILED ?? 0;
                const pending = (count.QUEUED ?? 0) + (count.RETRY ?? 0) + (count.PROCESSING ?? 0);
                return <TableRow key={campaign.id}>
                  <TableCell className="max-w-44 font-medium break-words">{campaign.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{campaign.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</TableCell>
                  <TableCell><Badge variant="secondary">{statusLabels[campaign.status]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{sent} terkirim, {failed} gagal, {pending} tertunda{campaign.startedAt && campaign.startedAt > campaign.scheduledAt ? ", mulai terlambat" : ""}</TableCell>
                  <TableCell><CampaignEnabledSwitch campaignId={campaign.id} version={campaign.version} status={campaign.status} /></TableCell>
                  <TableCell><div className="flex justify-end gap-2">
                    {campaign.status === "SCHEDULED" || campaign.status === "PAUSED" ? <Button size="sm" variant="outline" render={<Link href={`/campaigns?edit=${campaign.id}`} />} nativeButton={false}>Edit</Button> : null}
                    <form action={deleteCampaignAction}>
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <input type="hidden" name="version" value={campaign.version} />
                      <ConfirmSubmitButton size="sm" variant="destructive" confirmTitle="Hapus campaign?" confirmDescription="Campaign akan dihapus dari daftar. Pengiriman yang belum mulai dihentikan, sedangkan pesan yang sudah dikirim tetap tersimpan." confirmLabel="Ya, hapus campaign" pendingLabel="Menghapus...">Hapus</ConfirmSubmitButton>
                    </form>
                  </div></TableCell>
                </TableRow>;
              }) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Belum ada campaign.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
