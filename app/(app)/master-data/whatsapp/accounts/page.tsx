import { Link2, LogOut, Radio } from "lucide-react";

import { createWhatsAppAccountAction, disconnectWhatsAppAccountAction, enableWhatsAppAccountAction, requestWhatsAppPairingAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WhatsAppAutoRefresh } from "@/components/whatsapp-auto-refresh";
import { WhatsAppPairingCode } from "@/components/whatsapp-pairing-code";
import { getWhatsAppAccounts } from "@/lib/whatsapp/data";

export default async function WhatsAppAccountsPage() {
  const accounts = await getWhatsAppAccounts();
  return <main className="flex flex-col gap-6"><WhatsAppAutoRefresh enabled={accounts.some((account) => account.status === "PAIRING")} /><PageHeader title="Account WhatsApp" description="Hubungkan nomor bisnis dan tentukan satu nomor yang dipakai untuk mengirim." />
    <Card><CardHeader><CardTitle>Tambah nomor</CardTitle><CardDescription>Gunakan kode negara tanpa tanda tambah, misalnya 6281234567890.</CardDescription></CardHeader><CardContent><form action={createWhatsAppAccountAction}><FieldGroup className="gap-4 sm:flex-row sm:items-end"><Field><FieldLabel htmlFor="label">Label</FieldLabel><Input id="label" name="label" required maxLength={80} placeholder="WhatsApp utama" /></Field><Field><FieldLabel htmlFor="phoneNumber">Nomor</FieldLabel><Input id="phoneNumber" name="phoneNumber" required inputMode="tel" maxLength={24} placeholder="6281234567890" /></Field><Button type="submit">Tambah</Button></FieldGroup></form></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{accounts.map((account) => <Card key={account.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{account.label}</CardTitle><CardDescription>{account.phoneNumber}</CardDescription></div><Badge variant={account.status === "CONNECTED" ? "success" : account.status === "ERROR" ? "destructive" : "outline"}>{account.status}</Badge></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{account.lastError ?? (account.heartbeatAt ? `Heartbeat ${account.heartbeatAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` : "Worker belum melaporkan koneksi.")}</p><WhatsAppPairingCode code={account.pairingCode} expiresAt={account.pairingCodeExpiresAt?.toISOString() ?? null} waiting={account.status === "PAIRING"} /><div className="flex flex-wrap gap-2"><form action={requestWhatsAppPairingAction}><input type="hidden" name="accountId" value={account.id} /><SubmitButton pendingLabel="Meminta kode..." size="sm" variant="outline"><Link2 data-icon="inline-start" />Pairing</SubmitButton></form><form action={enableWhatsAppAccountAction}><input type="hidden" name="accountId" value={account.id} /><Button type="submit" size="sm" disabled={account.status !== "CONNECTED" || account.sendEnabled}><Radio data-icon="inline-start" />{account.sendEnabled ? "Aktif" : "Jadikan aktif"}</Button></form><form action={disconnectWhatsAppAccountAction}><input type="hidden" name="accountId" value={account.id} /><Button type="submit" size="sm" variant="destructive"><LogOut data-icon="inline-start" />Logout</Button></form></div></CardContent></Card>)}</div>
  </main>;
}
