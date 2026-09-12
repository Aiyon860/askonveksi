"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function WhatsAppMessageTimeline({
  children,
  conversationId,
  latestMessageId,
}: {
  children: ReactNode;
  conversationId: string;
  latestMessageId: string | null;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (timeline) timeline.scrollTop = timeline.scrollHeight;
  }, [conversationId, latestMessageId]);

  return (
    <div ref={timelineRef} className="flex h-[60vh] max-h-[640px] min-h-[480px] min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md bg-muted/30 p-3" aria-live="polite">
      {children}
    </div>
  );
}
