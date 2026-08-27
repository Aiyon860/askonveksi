import {
  ArrowRight,
  BanknoteArrowDown,
  Box,
  CircleDollarSign,
  Clock3,
  Factory,
  HandCoins,
  PackageCheck,
  Scissors,
  Shirt,
  Sparkles,
  Target,
  Truck,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/utils";

const metrics = [
  { label: "Omzet bulan ini", value: "Rp 185.500.000", note: "Pendapatan berjalan", icon: CircleDollarSign, issue: false },
  { label: "Piutang", value: "Rp 42.500.000", note: "Perlu ditagihkan", icon: HandCoins, issue: false },
  { label: "Hutang", value: "Rp 28.750.000", note: "Kewajiban berjalan", icon: BanknoteArrowDown, issue: false },
  { label: "Pengeluaran", value: "Rp 96.250.000", note: "Bulan berjalan", icon: WalletCards, issue: false },
  { label: "Order aktif", value: "37", note: "Sedang diproses", icon: PackageCheck, issue: false },
  { label: "Produksi", value: "21", note: "Order produksi aktif", icon: Factory, issue: false },
  { label: "Order terlambat", value: "4", note: "Butuh perhatian", icon: Clock3, issue: true },
  { label: "Lead baru", value: "32", note: "Potensi pelanggan", icon: UsersRound, issue: false },
] as const;

const production = [
  { label: "Menunggu desain", value: 5, icon: Sparkles, busiest: false },
  { label: "Menunggu bahan", value: 3, icon: Shirt, busiest: false },
  { label: "Cutting", value: 4, icon: Scissors, busiest: false },
  { label: "Printing", value: 6, icon: Box, busiest: false },
  { label: "Jahit", value: 8, icon: Factory, busiest: true },
  { label: "QC", value: 5, icon: PackageCheck, busiest: false },
  { label: "Packing", value: 3, icon: Box, busiest: false },
  { label: "Pengiriman", value: 7, icon: Truck, busiest: false },
] as const;

const highestProductionCount = Math.max(...production.map((stage) => stage.value));

const funnel = [
  { label: "Lead", value: 100, width: "100%" },
  { label: "Follow up", value: 45, width: "45%" },
  { label: "Penawaran", value: 20, width: "20%" },
  { label: "Deal", value: 12, width: "12%" },
] as const;

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-muted/50 text-foreground selection:bg-foreground selection:text-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1600px] items-end justify-between gap-6 px-5 py-6 sm:px-8 lg:px-12">
          <div>
            <h1 className="text-2xl font-bold leading-8">ASKONVEKSI DASHBOARD</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ringkasan kondisi bisnis dan operasional.</p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">Data dummy · Agustus 2026</p>
            <p className="mt-1 text-xs text-muted-foreground">Ringkasan bulanan</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
        <section aria-labelledby="ringkasan-title">
          <div className="mb-4">
            <h2 id="ringkasan-title" className="text-base font-semibold">Ringkasan bisnis</h2>
            <p className="mt-1 text-sm text-muted-foreground">Status utama yang perlu dipantau hari ini.</p>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="flex min-w-0 items-start justify-between gap-4 bg-card p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className={cn("mt-3 truncate font-mono text-xl font-semibold tabular-nums", metric.issue ? "text-destructive" : "text-card-foreground")}>
                      {metric.value}
                    </p>
                    <p className={cn("mt-1 text-xs", metric.issue ? "text-destructive" : "text-muted-foreground")}>{metric.note}</p>
                  </div>
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", metric.issue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-label="Ruang kerja detail">
          <article className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-5 border-b p-4">
              <div>
                <h2 className="text-base font-semibold">Dashboard produksi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Order produksi · jumlah job/item aktif per tahap.</p>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">Jahit terpadat</div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-4">
              {production.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.label} className="min-w-0">
                    <div className="mb-3 flex items-center">
                      <div className={cn("flex size-8 items-center justify-center rounded-md", stage.busiest ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      {index < production.length - 1 && <ArrowRight className="ml-2 hidden size-4 text-muted-foreground/40 sm:block" aria-hidden="true" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{stage.label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{stage.value}</p>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${(stage.value / highestProductionCount) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="m-4 mt-2 flex items-center gap-3 rounded-md border bg-muted/50 p-3">
              <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm"><span className="font-medium">Tahap terpadat:</span> Jahit memiliki 8 job/item aktif.</p>
            </div>
          </article>

          <article className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-5 border-b p-4">
              <div>
                <h2 className="text-base font-semibold">Dashboard sales</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pergerakan lead menuju deal.</p>
              </div>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Target className="size-4" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {funnel.map((step) => (
                <div key={step.label}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="font-mono text-sm font-medium tabular-nums">{step.value}</p>
                  </div>
                  <div className="h-8 overflow-hidden rounded-md bg-muted">
                    <div className="flex h-full min-w-12 items-center justify-end rounded-md bg-foreground px-2 font-mono text-xs text-background" style={{ width: step.width }}>
                      {step.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="m-4 mt-2 flex items-center justify-between gap-5 rounded-md bg-secondary p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Konversi</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">12%</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">12 deal dari 100 lead</p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
