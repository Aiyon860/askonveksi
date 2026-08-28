import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Pantau pembaruan pekerjaan dan tentukan mana yang masih perlu diperiksa."
        action={<Badge variant="outline">Data contoh</Badge>}
      />
      <NotificationCenter />
    </>
  );
}
