import { NextResponse } from "next/server";

import { CMS_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { MediaValidationError, saveUploadedImage } from "@/lib/cms/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireActor(CMS_ROLES);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Pilih file gambar terlebih dahulu." }, { status: 400 });
    }
    const alt = typeof formData.get("alt") === "string" ? String(formData.get("alt")) : "";
    const image = await saveUploadedImage(file, alt);
    return NextResponse.json({ ok: true, image });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Tidak punya akses." }, { status: 401 });
    }
    console.error("[cms] upload gagal:", error);
    return NextResponse.json({ ok: false, error: "Gambar gagal diunggah. Coba lagi." }, { status: 500 });
  }
}
