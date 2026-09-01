import { FinanceExpensesView } from "@/features/finance/finance-expenses-view";

export default async function FinanceExpensesPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <FinanceExpensesView workspaceSlug={workspace} />;
}
