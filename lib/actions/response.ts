import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export class UserFacingError extends Error {}

export function messageForError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return "Sesi atau hak akses Anda sudah berubah. Masuk kembali lalu coba lagi.";
  }
  if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
    return "Ganti password sementara sebelum menyimpan perubahan.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Data sudah berubah atau sudah pernah dibuat. Muat ulang lalu coba lagi.";
    if (error.code === "P2003") return "Dokumen terkait sudah berubah atau tidak lagi tersedia. Muat ulang lalu coba lagi.";
    if (error.code === "P2004") return "Data pembayaran tidak memenuhi aturan Sales Order. Periksa nilainya lalu coba lagi.";
    if (error.code === "P2028") return "Proses menyimpan Deal melewati batas waktu. Silakan coba sekali lagi.";
    if (error.code === "P2025") return "Data tidak ditemukan atau sudah berubah. Muat ulang halaman.";
    if (error.code === "P2034") return "Data berubah bersamaan saat Deal disimpan. Muat ulang lalu coba lagi.";
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Data Sales Order belum dapat diproses. Muat ulang halaman lalu coba lagi.";
  }
  return "Terjadi kendala saat menyimpan data. Silakan coba lagi.";
}

export const FLASH_MESSAGE_COOKIE = "askonveksi_flash";

export type FlashMessage = {
  id: string;
  kind: "notice" | "warning" | "error";
  message: string;
};

export function flashKindForError(error: unknown): Exclude<FlashMessage["kind"], "notice"> {
  if (error instanceof UserFacingError) return "warning";
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) return "warning";
  if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "PASSWORD_CHANGE_REQUIRED")) return "warning";
  return "error";
}

export async function flashMessagePath(path: string, kind: FlashMessage["kind"], message: string) {
  const value: FlashMessage = { id: randomUUID(), kind, message: message.slice(0, 500) };
  const cookieStore = await cookies();
  cookieStore.set(FLASH_MESSAGE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60,
  });
  return path;
}

export async function runRedirectingAction(
  fallbackPath: string,
  work: () => Promise<string>,
): Promise<never> {
  let destination: string;

  try {
    destination = await work();
  } catch (error) {
    destination = await flashMessagePath(fallbackPath, flashKindForError(error), messageForError(error));
  }

  redirect(destination);
}
