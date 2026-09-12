import type { WhatsAppAccountStatus } from "@prisma/client";

export const WHATSAPP_HEARTBEAT_TIMEOUT_MS = 30_000;

export type WhatsAppHealthState = "HEALTHY" | "NOT_CONFIGURED" | "WORKER_OFFLINE" | "DISCONNECTED" | "LOGGED_OUT" | "ERROR";
export type WhatsAppHealthBanner = "CONNECTION" | "FAILED_JOBS";

export function whatsappHealthChanged(previous: WhatsAppHealthState | null, next: WhatsAppHealthState) {
  return previous !== null && previous !== next;
}

export function classifyWhatsAppHealthBanner(state: WhatsAppHealthState, failedCount: number): WhatsAppHealthBanner | null {
  if (state !== "HEALTHY") return "CONNECTION";
  return failedCount > 0 ? "FAILED_JOBS" : null;
}

export function classifyWhatsAppHealth(
  account: { status: WhatsAppAccountStatus; heartbeatAt: Date | null; sendEnabled?: boolean } | null,
  now = new Date(),
): WhatsAppHealthState {
  if (!account) return "NOT_CONFIGURED";
  if (account.status === "LOGGED_OUT") return "LOGGED_OUT";
  if (account.status === "ERROR") return "ERROR";
  if (account.sendEnabled === false) return "NOT_CONFIGURED";
  if (account.status === "DISCONNECTED") return "DISCONNECTED";
  if (account.status === "CONNECTED" && (!account.heartbeatAt || now.getTime() - account.heartbeatAt.getTime() > WHATSAPP_HEARTBEAT_TIMEOUT_MS)) return "WORKER_OFFLINE";
  return "HEALTHY";
}
