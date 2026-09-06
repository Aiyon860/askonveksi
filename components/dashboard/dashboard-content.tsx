import { getSalesDashboardData } from "@/lib/crm/data";
import { DashboardContentClient, type DashboardData } from "@/components/dashboard/dashboard-content-client";

export async function DashboardContent() {
  const data = await getSalesDashboardData();
  return <DashboardContentClient initialData={data as DashboardData} />;
}
