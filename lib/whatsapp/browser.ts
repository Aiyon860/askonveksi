export function whatsappMessagesKey(conversationId: string | null | undefined) {
  return conversationId ? `/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages` : null;
}

export function whatsappMessagesLoading(data: unknown, error: unknown) {
  return data === undefined && !error;
}
