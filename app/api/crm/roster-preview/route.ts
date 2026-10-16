import { requireActor } from "@/lib/auth/session";
import { CRM_ROLES } from "@/lib/auth/permissions";
import { aggregateRosterToMatrix, parseRosterFile } from "@/lib/crm/roster-import";

export const runtime = "nodejs";

// C3: pratinjau file Excel roster — kembalikan agregat jumlah per ukuran
// agar matriks form terisi otomatis tanpa menyimpan apa pun.
export async function POST(request: Request) {
  try {
    await requireActor(CRM_ROLES);
  } catch {
    return Response.json({ ok: false, message: "Anda harus masuk." }, { status: 401 });
  }
  let file: File | null = null;
  try {
    const formData = await request.formData();
    const value = formData.get("file");
    if (value instanceof File) file = value;
  } catch {
    return Response.json({ ok: false, message: "File tidak terbaca." }, { status: 400 });
  }
  if (!file || !file.size) return Response.json({ ok: false, message: "Pilih file Excel roster." }, { status: 400 });
  try {
    const rows = await parseRosterFile(file);
    return Response.json({ ok: true, counts: aggregateRosterToMatrix(rows), total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File roster tidak valid.";
    return Response.json({ ok: false, message }, { status: 422 });
  }
}
