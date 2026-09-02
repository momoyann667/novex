import { BudgetFormView } from "@/features/budgets/budget-form-view";

export default async function NewBudgetPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <BudgetFormView workspaceSlug={workspace} />;
}
