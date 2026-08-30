import { ReportSectionView } from "@/features/reports/reports-view";

export default async function AnnualReportPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReportSectionView workspaceSlug={workspace} kind="annual" />;
}
