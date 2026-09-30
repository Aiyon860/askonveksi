import type { OpportunityStage } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { CircleCheckBig, CircleX, Handshake, PhoneCall, UserPlus } from "lucide-react";

export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "border-info/20 bg-info-surface",
  FOLLOW_UP: "border-highlight/20 bg-highlight-surface",
  NEGOSIASI: "border-warning/20 bg-warning-surface",
  DEAL: "border-success/20 bg-success-surface",
  LOST: "border-destructive/20 bg-destructive-surface",
};

export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "text-info-surface-foreground",
  FOLLOW_UP: "text-highlight-surface-foreground",
  NEGOSIASI: "text-warning-surface-foreground",
  DEAL: "text-success-surface-foreground",
  LOST: "text-destructive-surface-foreground",
};

/**
 * Ikon per tahap, untuk saat sebuah tahap berdiri sebagai kartu sendiri.
 * Lima kartu bertumpuk dengan bentuk yang sama persis terbaca sebagai satu blok
 * seragam; ikon memberi setiap tahap wujud yang bisa dikenali sebelum dibaca.
 */
export const STAGE_ICON: Record<OpportunityStage, LucideIcon> = {
  LEAD_BARU: UserPlus,
  FOLLOW_UP: PhoneCall,
  NEGOSIASI: Handshake,
  DEAL: CircleCheckBig,
  LOST: CircleX,
};
