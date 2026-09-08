import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "primary" | "danger" | "warning" | "success";

const toneClass: Record<MetricTone, string> = {
  neutral: "text-muted-foreground",
  primary: "text-primary",
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
};

export function MetricGroup({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      className={cn(
        "grid overflow-hidden rounded-lg border bg-border gap-px [&>*]:bg-card",
        className,
      )}
      {...props}
    />
  );
}

export function MetricItem({
  label,
  value,
  meta,
  icon: Icon,
  tone = "neutral",
  emphasis = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-26 flex-col justify-between gap-3 p-4", className)}>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className={cn("size-4", toneClass[tone])} /> : null}
        <span>{label}</span>
      </dt>
      <dd
        className={cn(
          "mt-auto font-mono font-semibold tabular-nums text-foreground",
          emphasis ? "text-2xl" : "text-xl",
          tone !== "neutral" && toneClass[tone],
        )}
      >
        {value}
      </dd>
      {meta ? <p className="-mt-1.5 text-xs text-muted-foreground">{meta}</p> : null}
    </div>
  );
}
