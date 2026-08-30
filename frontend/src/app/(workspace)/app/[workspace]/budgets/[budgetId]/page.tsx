import { BudgetDetailView } from "@/features/budgets/budget-detail-view";

export default function BudgetDetailPage({ params }: Readonly<{ params: { workspace: string; budgetId: string } }>) {
  return <BudgetDetailView workspaceSlug={params.workspace} />;
}
