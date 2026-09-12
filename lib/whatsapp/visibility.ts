export function conversationVisibility(actor: { id: string; role: string }) {
  return actor.role === "SALES"
    ? { customer: { is: { salesPicId: actor.id } } }
    : {};
}
