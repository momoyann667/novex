import { DashboardView } from "@/features/dashboard/dashboard-view";
import { emptyDashboardOverview } from "@/features/dashboard/data";

export default function WorkspaceDashboardPage() {
  return <DashboardView initialData={emptyDashboardOverview} />;
}
