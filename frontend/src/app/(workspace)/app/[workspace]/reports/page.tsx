import { ReportsView } from "@/features/reports/reports-view";

export default async function ReportsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReportsView workspaceSlug={workspace} />;
}
