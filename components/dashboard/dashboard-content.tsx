import { getDashboardFullAnalyticsData } from "@/lib/crm/dashboard-data";
import { DashboardContentClient } from "@/components/dashboard/dashboard-content-client";

export async function DashboardContent() {
  const data = await getDashboardFullAnalyticsData();
  return <DashboardContentClient initialData={data} />;
}
