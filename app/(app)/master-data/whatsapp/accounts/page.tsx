import { Link2, LogOut, Radio, Trash2 } from "lucide-react";

import { createWhatsAppAccountAction, deleteWhatsAppAccountAction, disconnectWhatsAppAccountAction, enableWhatsAppAccountAction, requestWhatsAppPairingAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WhatsAppAutoRefresh } from "@/components/whatsapp-auto-refresh";
import { WhatsAppDeletionMonitor } from "@/components/whatsapp-deletion-monitor";
import { WhatsAppPairingCode } from "@/components/whatsapp-pairing-code";
import { getWhatsAppAccounts } from "@/lib/whatsapp/data";

export default async function WhatsAppAccountsPage() {
  const accounts = await getWhatsAppAccounts();
  const hasPairing = accounts.some((account) => account.status === "PAIRING");
  const hasDeleting = accounts.some((account) => account.deleteRequestedAt);
  return <main className="flex flex-col gap-6"><WhatsAppAutoRefresh enabled={hasPairing || hasDeleting} /><WhatsAppDeletionMonitor active={hasDeleting} /><PageHeader title="Akun & Koneksi WhatsApp" description="Hubungkan nomor bisnis dan tentukan satu nomor yang dipakai untuk mengirim." />
    <Card><CardHeader><CardTitle>Tambah nomor</CardTitle><CardDescription>Gunakan kode negara tanpa tanda tambah, misalnya 6281234567890.</CardDescription></CardHeader><CardContent><form action={createWhatsAppAccountAction}><FieldGroup className="gap-4 sm:flex-row sm:items-end"><Field><FieldLabel htmlFor="label">Label</FieldLabel><Input id="label" name="label" required maxLength={80} placeholder="WhatsApp utama" /></Field><Field><FieldLabel htmlFor="phoneNumber">Nomor</FieldLabel><Input id="phoneNumber" name="phoneNumber" required inputMode="tel" maxLength={24} placeholder="6281234567890" /></Field><Button type="submit">Tambah</Button></FieldGroup></form></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{accounts.map((account) => {
      const deleting = Boolean(account.deleteRequestedAt);
      return <Card key={account.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{account.label}</CardTitle><CardDescription>{account.phoneNumber}</CardDescription></div><Badge variant={deleting ? "secondary" : account.status === "CONNECTED" ? "success" : account.status === "ERROR" ? "destructive" : "outline"}>{deleting ? "MENGHAPUS" : account.status}</Badge></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{deleting ? (account.lastError ?? "Penghapusan chat dan media berjalan di latar belakang.") : (account.lastError ?? (account.heartbeatAt ? `Heartbeat ${account.heartbeatAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` : "Worker belum melaporkan koneksi."))}</p><WhatsAppPairingCode code={account.pairingCode} expiresAt={account.pairingCodeExpiresAt?.toISOString() ?? null} waiting={account.status === "PAIRING"} /><p className="text-xs text-muted-foreground">Kode pairing berlaku 60 detik. Jika kedaluwarsa, klik Pairing lagi untuk meminta kode baru.</p><div className="flex flex-wrap items-center gap-2 justify-between"><div className="flex flex-wrap gap-2"><form action={requestWhatsAppPairingAction}><input type="hidden" name="accountId" value={account.id} /><SubmitButton pendingLabel="Meminta kode..." size="sm" variant="outline" disabled={deleting}><Link2 data-icon="inline-start" />Pairing</SubmitButton></form><form action={enableWhatsAppAccountAction}><input type="hidden" name="accountId" value={account.id} /><Button type="submit" size="sm" disabled={deleting || account.status !== "CONNECTED" || account.sendEnabled}><Radio data-icon="inline-start" />{account.sendEnabled ? "Aktif" : "Jadikan aktif"}</Button></form><form action={disconnectWhatsAppAccountAction}><input type="hidden" name="accountId" value={account.id} /><Button type="submit" size="sm" variant="destructive" disabled={deleting}><LogOut data-icon="inline-start" />Logout</Button></form></div><form action={deleteWhatsAppAccountAction} className="ml-auto"><input type="hidden" name="accountId" value={account.id} /><ConfirmSubmitButton pendingLabel="Menghapus..." size="sm" variant="destructive" disabled={deleting} confirmTitle="Hapus nomor ini?" confirmDescription={`Nomor ${account.label} (${account.phoneNumber}) beserta seluruh riwayat chat dan medianya akan dihapus permanen di latar belakang.`} confirmLabel="Ya, hapus"><Trash2 data-icon="inline-start" />Hapus</ConfirmSubmitButton></form></div></CardContent></Card>;
    })}</div>
  </main>;
}
