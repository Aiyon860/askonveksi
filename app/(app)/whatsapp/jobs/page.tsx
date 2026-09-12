import Link from "next/link";

import { cancelWhatsAppJobAction, retryWhatsAppJobAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatsAppAutoRefresh } from "@/components/whatsapp-auto-refresh";
import { getWhatsAppJobs } from "@/lib/whatsapp/data";

const statuses = ["QUEUED", "PROCESSING", "COMPLETED", "RETRY", "FAILED", "CANCELLED"] as const;
const statusLabels = { QUEUED: "Menunggu", PROCESSING: "Sedang diproses", COMPLETED: "Terkirim", RETRY: "Akan dicoba lagi", FAILED: "Gagal", CANCELLED: "Dibatalkan" } as const;
const typeLabels = { MANUAL: "Manual", NEXT_ACTION: "Tindak lanjut", REPEAT_ORDER: "Automasi lama", REACTIVATION: "Reminder order", INVOICE_ISSUED: "Invoice terbit", INVOICE_DUE: "Pengingat pembayaran" } as const;

function jobNote(job: Awaited<ReturnType<typeof getWhatsAppJobs>>[number]) {
  if (job.lastError) return job.lastError;
  if (job.status === "QUEUED") return `Menunggu worker. Jadwal: ${job.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}.`;
  if (job.status === "PROCESSING") return "Sedang dikirim oleh worker.";
  if (!job.account) return "Nomor pengirim belum dipilih.";
  if (!job.account.sendEnabled) return `${job.account.label} tidak aktif sebagai pengirim.`;
  if (job.account.status !== "CONNECTED") return `${job.account.label} berstatus ${job.account.status}.`;
  return job.account.heartbeatAt
    ? `Worker aktif: ${job.account.heartbeatAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}.`
    : "Worker belum mengirim heartbeat.";
}

export default async function WhatsAppJobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const status = statuses.find((item) => item === requested);
  const jobs = await getWhatsAppJobs(status);
  return <main className="flex flex-col gap-6"><WhatsAppAutoRefresh /><PageHeader title="Status Pengiriman WhatsApp" description="Pantau hasil pengiriman manual dan otomatis terbaru." action={<Button variant="outline" render={<Link href="/whatsapp" />} nativeButton={false}>Kembali ke WhatsApp</Button>} /><form className="flex max-w-sm gap-2"><NativeSelect name="status" defaultValue={status ?? ""} aria-label="Filter status pengiriman"><NativeSelectOption value="">Semua status</NativeSelectOption>{statuses.map((item) => <NativeSelectOption key={item} value={item}>{statusLabels[item]}</NativeSelectOption>)}</NativeSelect><Button type="submit" variant="outline">Filter</Button></form><Card><CardContent><Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Percobaan</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell>{job.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell><TableCell>{job.customer.companyName ?? job.customer.name}</TableCell><TableCell>{typeLabels[job.type]}</TableCell><TableCell><Badge variant={job.status === "FAILED" ? "destructive" : job.status === "COMPLETED" ? "success" : "outline"}>{statusLabels[job.status]}</Badge></TableCell><TableCell>{job.attempts}</TableCell><TableCell className="max-w-80 whitespace-normal text-muted-foreground">{jobNote(job)}</TableCell><TableCell><div className="flex justify-end gap-2">{["FAILED", "CANCELLED"].includes(job.status) ? <form action={retryWhatsAppJobAction}><input type="hidden" name="jobId" value={job.id} /><Button type="submit" size="sm" variant="outline">Ulangi</Button></form> : null}{["QUEUED", "RETRY", "FAILED"].includes(job.status) ? <form action={cancelWhatsAppJobAction}><input type="hidden" name="jobId" value={job.id} /><Button type="submit" size="sm" variant="ghost">Batalkan</Button></form> : null}</div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></main>;
}
