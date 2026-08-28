import { cookies } from "next/headers";

import { FlashMessageAlert } from "@/components/flash-message-alert";
import { FLASH_MESSAGE_COOKIE, type FlashMessage } from "@/lib/actions/response";

export async function PageMessage() {
  const raw = (await cookies()).get(FLASH_MESSAGE_COOKIE)?.value;
  let flash: FlashMessage | null = null;

  try {
    const parsed = raw ? JSON.parse(raw) as Partial<FlashMessage> : null;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      (parsed.kind === "notice" || parsed.kind === "error") &&
      typeof parsed.message === "string"
    ) {
      flash = parsed as FlashMessage;
    }
  } catch {
    flash = null;
  }

  if (!flash) return null;

  return <FlashMessageAlert flash={flash} />;
}
