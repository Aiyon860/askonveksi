import { ATTENDANCE_ADMIN_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getAttendancePhotoRecord } from "@/lib/attendance/data";
import { readAttendancePhoto } from "@/lib/attendance/photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentActor();
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const record = await getAttendancePhotoRecord(id);
  if (!record || !record.photoPath) {
    return new Response("Not found", { status: 404 });
  }

  const isOwnerOrDeveloper = hasRole(actor.role, ATTENDANCE_ADMIN_ROLES);
  if (record.userId !== actor.id && !isOwnerOrDeveloper) {
    // 404 agar keberadaan foto pegawai lain tidak bisa ditebak.
    return new Response("Not found", { status: 404 });
  }

  const photo = await readAttendancePhoto(record.photoPath);
  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": record.photoMimeType || "image/webp",
      "Content-Length": String(photo.bytes.length),
      "Content-Disposition": `inline; filename="absensi-${record.id}.webp"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
