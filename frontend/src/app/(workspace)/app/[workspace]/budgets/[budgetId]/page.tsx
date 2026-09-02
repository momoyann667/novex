import { BudgetDetailView } from "@/features/budgets/budget-detail-view";

export default async function BudgetDetailPage({ params }: Readonly<{ params: Promise<{ workspace: string; budgetId: string }> }>) {
  const { workspace, budgetId } = await params;
  return <BudgetDetailView workspaceSlug={workspace} budgetId={budgetId} />;
}
