import { ReportSectionView } from "@/features/reports/reports-view";

export default async function ContributionsReportPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReportSectionView workspaceSlug={workspace} kind="contributions" />;
}
