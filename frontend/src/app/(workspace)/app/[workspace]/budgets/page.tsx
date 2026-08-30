import { BudgetsView } from "@/features/budgets/budgets-view";

export default function BudgetsPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <BudgetsView workspaceSlug={params.workspace} />;
}

