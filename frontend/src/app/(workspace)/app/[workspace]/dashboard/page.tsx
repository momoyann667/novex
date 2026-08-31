import { DashboardView } from "@/features/dashboard/dashboard-view";
import { emptyDashboardOverview } from "@/features/dashboard/data";

export default async function WorkspaceDashboardPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <DashboardView initialData={emptyDashboardOverview} workspaceSlug={workspace} />;
}
