import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { WhatsAppAutoRefresh } from "@/components/whatsapp-auto-refresh";
import { WhatsAppInbox } from "@/components/whatsapp-inbox";
import { getCustomerOptions } from "@/lib/crm/data";
import { getCustomerFormOptions } from "@/lib/master-data";
import { getWhatsAppInbox } from "@/lib/whatsapp/data";

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ conversation?: string; q?: string }> }) {
  const query = await searchParams;
  const data = await getWhatsAppInbox(query.conversation, query.q);
  const needsCustomerOptions = data.canSeeUnknown && data.conversations.some((conversation) => !conversation.customer);
  const [customers, customerFormOptions] = needsCustomerOptions
    ? await Promise.all([getCustomerOptions(), getCustomerFormOptions()])
    : [[], null];

  return (
    <main className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden">
      <WhatsAppAutoRefresh />
      <PageHeader title="WhatsApp" description="Percakapan customer dan status pengiriman dari nomor bisnis ASKonveksi." action={<Button variant="outline" render={<Link href="/whatsapp/jobs" />} nativeButton={false}>Cek status pengiriman</Button>} />
      <WhatsAppInbox
        conversations={data.conversations}
        templates={data.templates}
        query={query.q}
        canSeeUnknown={data.canSeeUnknown}
        customers={customers}
        customerFormOptions={customerFormOptions}
      />
    </main>
  );
}
