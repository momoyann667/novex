import { redirect } from "next/navigation";

export default async function ExpensesAliasPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  redirect(`/app/${workspace}/finance/expenses`);
}
