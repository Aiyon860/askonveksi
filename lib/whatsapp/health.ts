import type { WhatsAppAccountStatus } from "@prisma/client";

export const WHATSAPP_HEARTBEAT_TIMEOUT_MS = 30_000;

export type WhatsAppHealthState = "HEALTHY" | "NOT_CONFIGURED" | "WORKER_OFFLINE" | "DISCONNECTED" | "LOGGED_OUT" | "ERROR";

/** Satu-satunya keadaan yang berarti nomor siap dipakai. */
export function isWhatsAppConnected(state: WhatsAppHealthState) {
  return state === "HEALTHY";
}

/** Penjelasan singkat per keadaan, dipakai sebagai tooltip status di navigasi. */
export function describeWhatsAppHealth(state: WhatsAppHealthState): string {
  switch (state) {
    case "HEALTHY":
      return "Nomor WhatsApp terhubung dan worker aktif.";
    case "NOT_CONFIGURED":
      return "Belum ada nomor WhatsApp aktif.";
    case "WORKER_OFFLINE":
      return "Worker WhatsApp tidak memberi heartbeat.";
    case "DISCONNECTED":
      return "Nomor WhatsApp terputus.";
    case "LOGGED_OUT":
      return "Nomor WhatsApp telah logout dan perlu dipasangkan ulang.";
    case "ERROR":
      return "Integrasi WhatsApp mengalami kendala.";
  }
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
