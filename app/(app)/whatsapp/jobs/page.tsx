import { cancelWhatsAppJobAction, retryWhatsAppJobAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWhatsAppJobs } from "@/lib/whatsapp/data";

const statuses = ["QUEUED", "PROCESSING", "COMPLETED", "RETRY", "FAILED", "CANCELLED"] as const;

export default async function WhatsAppJobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const status = statuses.find((item) => item === requested);
  const jobs = await getWhatsAppJobs(status);
  return <main className="flex flex-col gap-6"><PageHeader title="Antrean WhatsApp" description="Status pengiriman manual dan automasi WhatsApp terbaru." /><form className="flex max-w-sm gap-2"><NativeSelect name="status" defaultValue={status ?? ""} aria-label="Filter status job"><NativeSelectOption value="">Semua status</NativeSelectOption>{statuses.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect><Button type="submit" variant="outline">Filter</Button></form><Card><CardContent><Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Percobaan</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell>{job.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell><TableCell>{job.customer.companyName ?? job.customer.name}</TableCell><TableCell>{job.type.replaceAll("_", " ")}</TableCell><TableCell><Badge variant={job.status === "FAILED" ? "destructive" : job.status === "COMPLETED" ? "success" : "outline"}>{job.status}</Badge></TableCell><TableCell>{job.attempts}</TableCell><TableCell className="max-w-72 truncate text-muted-foreground">{job.lastError ?? job.account?.label ?? "-"}</TableCell><TableCell><div className="flex justify-end gap-2">{["FAILED", "CANCELLED"].includes(job.status) ? <form action={retryWhatsAppJobAction}><input type="hidden" name="jobId" value={job.id} /><Button type="submit" size="sm" variant="outline">Ulangi</Button></form> : null}{["QUEUED", "RETRY"].includes(job.status) ? <form action={cancelWhatsAppJobAction}><input type="hidden" name="jobId" value={job.id} /><Button type="submit" size="sm" variant="ghost">Batalkan</Button></form> : null}</div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></main>;
}
