import { DocumentDashboardView } from "@/features/documents/document-dashboard-view";

export default async function DocumentDashboardPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <DocumentDashboardView workspaceSlug={workspace} />;
}
