import { BroadcastWorkspace } from "@/components/crm/broadcast-workspace";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getBroadcastRecipientOptions, getFollowUpTemplateBody } from "@/lib/whatsapp/data";
import { Megaphone } from "lucide-react";

export async function BroadcastContent() {
  const [recipients, defaultMessage] = await Promise.all([
    getBroadcastRecipientOptions({}),
    getFollowUpTemplateBody(),
  ]);

  if (!recipients.items.length) {
    return (
      <Empty className="min-h-72 rounded-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Megaphone aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Belum ada customer aktif</EmptyTitle>
          <EmptyDescription>Tambahkan customer terlebih dahulu sebelum mengirim broadcast Repeat Order.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <BroadcastWorkspace
      initial={{
        items: recipients.items,
        total: recipients.total,
        truncated: recipients.truncated,
        customerTypes: recipients.customerTypes,
      }}
      defaultMessage={defaultMessage}
    />
  );
}
