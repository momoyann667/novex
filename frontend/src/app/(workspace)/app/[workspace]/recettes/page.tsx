import { FinanceIncomeView } from "@/features/finance/finance-income-view";

export default async function RecettesPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <FinanceIncomeView workspaceSlug={workspace} />;
}
