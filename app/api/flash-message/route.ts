import { cookies } from "next/headers";

import { FLASH_MESSAGE_COOKIE, type FlashMessage } from "@/lib/actions/response";

export async function DELETE(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response(null, { status: 403 });
  }

  const id = request.headers.get("x-flash-message-id");
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_MESSAGE_COOKIE)?.value;
  if (!id || !raw) return new Response(null, { status: 204 });

  try {
    const current = JSON.parse(raw) as Partial<FlashMessage>;
    if (current.id === id) cookieStore.delete(FLASH_MESSAGE_COOKIE);
  } catch {
    cookieStore.delete(FLASH_MESSAGE_COOKIE);
  }
  return new Response(null, { status: 204 });
}
