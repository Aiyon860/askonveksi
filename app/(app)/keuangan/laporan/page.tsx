import { FileText } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";

export default function FinanceReportPage() { return <><PageHeader title="Laporan" description="Laporan keuangan akan tersedia di halaman ini." /><Empty className="min-h-80 rounded-lg border bg-card"><EmptyHeader><EmptyMedia variant="icon"><FileText aria-hidden="true" /></EmptyMedia><EmptyTitle>Laporan akan tersedia kemudian</EmptyTitle><EmptyDescription>Gunakan Pemasukan dan Pengeluaran untuk melihat pencatatan saat ini.</EmptyDescription></EmptyHeader></Empty></>; }
