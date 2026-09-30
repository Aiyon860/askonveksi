import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type DashTone = "neutral" | "primary" | "danger" | "warning" | "success" | "info";

/** Semua chip memakai permukaan solid, bukan lapisan transparan. */
const chipToneClass: Record<DashTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-highlight-surface text-highlight-surface-foreground",
  danger: "bg-destructive-surface text-destructive-surface-foreground",
  warning: "bg-warning-surface text-warning-surface-foreground",
  success: "bg-success-surface text-success-surface-foreground",
  info: "bg-info-surface text-info-surface-foreground",
};

const valueToneClass: Record<DashTone, string> = {
  neutral: "text-foreground",
  primary: "text-highlight-surface-foreground",
  danger: "text-destructive-surface-foreground",
  warning: "text-warning-surface-foreground",
  success: "text-success-surface-foreground",
  info: "text-info-surface-foreground",
};

/**
 * Panel di dalam kartu: ber-tint sesuai maknanya dengan garis tipis senada.
 * Kartu putih di sekitarnya memakai bayangan, jadi lapisan dalam ini tidak
 * menambah bayangan lagi—satu bidang, satu cara menyatakan kedalaman.
 */
const tintedSurfaceClass: Record<DashTone, string> = {
  neutral: "border-border bg-muted",
  primary: "border-highlight/20 bg-highlight-surface",
  danger: "border-destructive/20 bg-destructive-surface",
  warning: "border-warning/20 bg-warning-surface",
  success: "border-success/20 bg-success-surface",
  info: "border-info/20 bg-info-surface",
};

const barToneClass: Record<DashTone, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-highlight",
  danger: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
};

const VALUE_CLASS = "font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums";

/**
 * Angka jangkar boleh naik satu langkah, tapi hanya saat kartunya benar-benar
 * lebar (setengah baris pada xl). Di bawah itu teksnya akan melebihi kartu.
 */
const ACCENT_VALUE_CLASS = "font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums xl:text-3xl";

/**
 * Tiga lapisan dashboard, masing-masing dengan satu cara menyatakan kedalaman:
 * kanvas, kartu panel (bayangan), dan bidang tonal di dalam kartu (tint, tanpa
 * bayangan). Tidak ada lapisan yang memakai garis sekaligus bayangan.
 */
export const DASH_CARD_CLASS = "dash-panel rounded-xl border-0 bg-card";

/**
 * Ritme kolom baris KPI sales.
 * Dipakai juga oleh skeleton agar barisnya tidak pernah melenceng dari isi aslinya.
 */
export const DASH_SALES_SPANS = [
  "sm:col-span-2 xl:col-span-3",
  "xl:col-span-3",
  "xl:col-span-2",
  "xl:col-span-2",
  "xl:col-span-2",
] as const;

/*
  Kartu angka: baris label menempel di atas, lalu angkanya diletakkan di tengah
  ruang yang tersisa. Karena baris grid menyamakan tinggi kartu, kartu yang
  isinya lebih pendek akan menyisakan ruang—ruang itu dibagi rata di atas dan
  bawah angka, bukan dibiarkan menggantung di bawah.
*/
export const DASH_STAT_TILE_CLASS = "flex flex-col gap-4 rounded-xl border p-4 sm:p-5";

/** Isi `dd`: mengisi sisa tinggi kartu dan memusatkan angkanya di situ. */
export const DASH_TILE_VALUE_CLASS = "flex flex-1 flex-col justify-center gap-2.5";

export const DASH_ACCENT_TILE_CLASS =
  "dash-accent dash-panel flex h-full flex-col gap-4 rounded-xl border border-transparent p-4 text-white sm:p-5";

export function DashSectionHeading({
  id,
  title,
  description,
}: {
  id?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="font-heading text-base font-semibold text-balance">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
    </div>
  );
}

function RatioBar({
  value,
  tone = "neutral",
  trackClassName,
  barClassName,
}: {
  value: number;
  tone?: DashTone;
  trackClassName?: string;
  barClassName?: string;
}) {
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

  return (
    <span aria-hidden="true" className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", trackClassName)}>
      <span className={cn("block h-full rounded-full", barToneClass[tone], barClassName)} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

function TileLabel({ icon: Icon, label, className, chipClassName }: { icon?: LucideIcon; label: React.ReactNode; className?: string; chipClassName?: string }) {
  return (
    <dt className={className}>
      {Icon ? (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", chipClassName)}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <span className="min-w-0">{label}</span>
    </dt>
  );
}

/**
 * Kartu angka pada baris KPI.
 * Urutannya keterangan lebih dulu, lalu angkanya—sama seperti urutan DOM-nya,
 * sehingga pembaca layar dan mata menerima urutan yang sama.
 */
export function DashStatTile({
  label,
  value,
  meta,
  icon: Icon,
  tone = "neutral",
  panel = "card",
  ratio,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  tone?: DashTone;
  /** `card` berdiri sendiri di kanvas, `tinted` duduk di dalam kartu sebagai bidang status. */
  panel?: "card" | "tinted";
  ratio?: number | null;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        DASH_STAT_TILE_CLASS,
        panel === "tinted" ? tintedSurfaceClass[tone] : "dash-panel border-transparent bg-card",
        className,
      )}
    >
      <TileLabel
        icon={Icon}
        label={label}
        className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground"
        chipClassName={chipToneClass[tone]}
      />
      <dd className={DASH_TILE_VALUE_CLASS}>
        <span className={cn(VALUE_CLASS, valueToneClass[tone])}>{value}</span>
        {typeof ratio === "number" ? <RatioBar value={ratio} tone={tone} /> : null}
        {meta ? <span className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{meta}</span> : null}
      </dd>
    </dl>
  );
}

/**
 * Kartu jangkar pada baris KPI: satu bidang biru penuh untuk angka terpenting,
 * sehingga warna menandai prioritas alih-alih menjadi sapuan latar.
 * Teks sekunder diturunkan dari warna bidangnya, bukan dari abu-abu.
 */
export function DashAccentTile({
  label,
  value,
  meta,
  icon: Icon,
  ratio,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  ratio?: number | null;
  className?: string;
}) {
  return (
    <dl className={cn(DASH_ACCENT_TILE_CLASS, className)}>
      <TileLabel
        icon={Icon}
        label={label}
        className="flex items-center gap-2.5 text-sm font-medium text-accent-ink-muted"
        chipClassName="bg-accent-chip text-white"
      />
      <dd className={DASH_TILE_VALUE_CLASS}>
        <span className={cn(ACCENT_VALUE_CLASS, "text-white")}>{value}</span>
        {typeof ratio === "number" ? <RatioBar value={ratio} trackClassName="bg-accent-surface-line" barClassName="bg-white" /> : null}
        {meta ? <span className="border-t border-accent-surface-line pt-3 text-xs leading-5 text-accent-ink-muted">{meta}</span> : null}
      </dd>
    </dl>
  );
}

/**
 * Kartu tahap pipeline. Permukaan dan warna tinta tetap milik `stage-theme`,
 * jadi tahap yang sama tampil dengan hue yang sama di papan CRM.
 * Selain jumlah, kartu ini membawa porsi tahapnya terhadap seluruh pipeline—
 * satu angka tanpa konteks tidak memberi tahu di mana alurnya menumpuk.
 */
export function DashStageTile({
  icon: Icon,
  label,
  value,
  meta,
  share,
  surfaceClassName,
  inkClassName,
  className,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  meta: React.ReactNode;
  /** Porsi tahap ini terhadap seluruh pipeline, 0–1. */
  share: number;
  surfaceClassName: string;
  inkClassName: string;
  className?: string;
}) {
  const ratio = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;

  return (
    <dl className={cn("flex flex-col gap-4 rounded-xl border p-4", surfaceClassName, className)}>
      <dt className="flex flex-wrap items-center gap-2.5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-card", inkClassName)}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className={cn("text-sm font-medium", inkClassName)}>{label}</span>
      </dt>
      <dd className={DASH_TILE_VALUE_CLASS}>
        <p className={cn(VALUE_CLASS, inkClassName)}>{value}</p>
        {/* Isian bar mengikuti warna teks kartu, jadi ia tidak pernah lepas dari tahapnya. */}
        <span aria-hidden="true" className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-card", inkClassName)}>
          <span className="block h-full rounded-full bg-current" style={{ width: `${ratio * 100}%` }} />
        </span>
        <span className="text-xs leading-5 text-muted-foreground">{meta}</span>
      </dd>
    </dl>
  );
}

/** Chip ikon untuk baris daftar (dokumen dan next action). */
export function DashRowIcon({ icon: Icon, tone = "primary" }: { icon: LucideIcon; tone?: DashTone }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", chipToneClass[tone])}>
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}
