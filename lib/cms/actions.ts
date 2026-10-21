"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { CMS_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  CMS_CACHE_TAG,
  CmsBusyError,
  CmsConflictError,
  CmsValidationError,
  restoreSiteContent,
  saveSiteContent,
} from "@/lib/cms/store";

export type SaveCmsResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; error: string };

function messageForError(error: unknown) {
  if (error instanceof CmsValidationError || error instanceof CmsConflictError || error instanceof CmsBusyError) {
    return error.message;
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return "Sesi atau hak akses Anda sudah berubah. Masuk kembali lalu coba lagi.";
  }
  console.error("[cms] gagal menyimpan:", error);
  return "Konten gagal disimpan. Coba lagi.";
}

export async function saveContentAction(input: unknown, expectedVersion: number): Promise<SaveCmsResult> {
  try {
    const actor = await requireActor(CMS_ROLES);
    const saved = await saveSiteContent(input, expectedVersion, { id: actor.id, name: actor.name });
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
    return { ok: true, version: saved.version, updatedAt: saved.updatedAt };
  } catch (error) {
    return { ok: false, error: messageForError(error) };
  }
}

export async function restoreContentAction(file: string): Promise<SaveCmsResult> {
  try {
    const actor = await requireActor(CMS_ROLES);
    const saved = await restoreSiteContent(file, { id: actor.id, name: actor.name });
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
    return { ok: true, version: saved.version, updatedAt: saved.updatedAt };
  } catch (error) {
    return { ok: false, error: messageForError(error) };
  }
}
