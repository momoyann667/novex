import { ReportSectionView } from "@/features/reports/reports-view";

export default async function MembersReportPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReportSectionView workspaceSlug={workspace} kind="members" />;
}
