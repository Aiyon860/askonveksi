import { CircleCheck } from "lucide-react";
import { cookies } from "next/headers";

import { FlashMessageClearer } from "@/components/flash-message-clearer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const isError = flash.kind === "error";

  return (
    <Alert variant={isError ? "destructive" : "success"}>
      <FlashMessageClearer id={flash.id} />
      {!isError ? <CircleCheck aria-hidden="true" /> : null}
      <AlertTitle>{isError ? "Tindakan belum berhasil" : "Berhasil"}</AlertTitle>
      <AlertDescription>{flash.message}</AlertDescription>
    </Alert>
  );
}
