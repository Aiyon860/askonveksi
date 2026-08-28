"use client";

import { useEffect } from "react";

export function FlashMessageClearer({ id }: { id: string }) {
  useEffect(() => {
    void fetch("/api/flash-message", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "x-flash-message-id": id },
    });
  }, [id]);

  return null;
}
