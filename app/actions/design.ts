"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { DESIGN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

function extension(name: string) {
  return /\.([a-z0-9]{1,10})$/i.exec(name)?.[1]?.toLowerCase() ?? "";
}

function isDesignFile(bytes: Uint8Array, fileExtension: string) {
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const psd = bytes.length >= 4 && bytes[0] === 56 && bytes[1] === 66 && bytes[2] === 80 && bytes[3] === 83;
  return fileExtension === "png" ? png : fileExtension === "psd" ? psd : false;
}

export async function uploadDesignRevisionAction(formData: FormData) {
  return runRedirectingAction("/desain", async () => {
    const actor = await requireActor(DESIGN_ROLES);
    const taskId = entityIdSchema.safeParse(formData.get("designTaskId"));
    if (!taskId.success) throw new UserFacingError("Tugas desain tidak valid.");
    const files = formData.getAll("designFiles").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) throw new UserFacingError("Pilih minimal satu file desain.");
    if (files.length > MAX_FILES) throw new UserFacingError("Maksimal lima file setiap versi desain.");

    const attachments = await Promise.all(files.map(async (file) => {
      if (file.size > MAX_BYTES) throw new UserFacingError("Setiap file desain maksimal 5 MB.");
      const fileExtension = extension(file.name);
      if (fileExtension !== "png" && fileExtension !== "psd") throw new UserFacingError("Desain hanya boleh berupa PNG atau PSD.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isDesignFile(bytes, fileExtension)) throw new UserFacingError("Isi file tidak sesuai format PNG atau PSD.");
      return {
        bytes,
        originalName: file.name.slice(0, 255),
        sizeBytes: file.size,
        contentType: fileExtension === "png" ? "image/png" : "image/vnd.adobe.photoshop",
        path: `design/${taskId.data}/${randomUUID()}.${fileExtension}`,
      };
    }));

    const storage = createAdminClient().storage.from(BUCKET);
    const uploaded: string[] = [];
    try {
      await Promise.all(attachments.map(async (attachment) => {
        const { error } = await storage.upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
        if (error) throw new UserFacingError("File desain belum dapat disimpan.");
        uploaded.push(attachment.path);
      }));

      const prisma = getPrismaClient();
      await prisma.$transaction(async (tx) => {
        const task = await tx.designTask.findUnique({ where: { id: taskId.data }, select: { id: true } });
        if (!task) throw new UserFacingError("Tugas desain tidak ditemukan.");
        const latest = await tx.designRevision.aggregate({ where: { designTaskId: task.id }, _max: { revision: true } });
        const revision = await tx.designRevision.create({
          data: {
            designTaskId: task.id,
            revision: (latest._max.revision ?? 0) + 1,
            notes: typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim().slice(0, 4000) || null : null,
            createdById: actor.id,
            attachments: { create: attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ path, originalName, contentType, sizeBytes })) },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "DesignRevision",
            entityId: revision.id,
            action: "DESIGN_REVISION_UPLOADED",
            changedFields: ["revision", "notes", "attachments"],
            metadata: { designTaskId: task.id, fileCount: attachments.length },
          },
        });
      });
    } catch (error) {
      if (uploaded.length) await storage.remove(uploaded);
      throw error;
    }

    revalidatePath("/desain");
    return flashMessagePath("/desain", "notice", "Versi desain berhasil diunggah.");
  });
}
