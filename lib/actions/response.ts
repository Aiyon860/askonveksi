import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export class UserFacingError extends Error {}

export function messageForError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Data sudah berubah atau sudah pernah dibuat. Muat ulang lalu coba lagi.";
    if (error.code === "P2025") return "Data tidak ditemukan atau sudah berubah. Muat ulang halaman.";
  }
  return "Terjadi kendala saat menyimpan data. Silakan coba lagi.";
}

export const FLASH_MESSAGE_COOKIE = "askonveksi_flash";

export type FlashMessage = {
  id: string;
  kind: "notice" | "error";
  message: string;
};

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
    destination = await flashMessagePath(fallbackPath, "error", messageForError(error));
  }

  redirect(destination);
}
