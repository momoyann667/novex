import { BudgetsView } from "@/features/budgets/budgets-view";

export default async function BudgetsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <BudgetsView workspaceSlug={workspace} />;
}
