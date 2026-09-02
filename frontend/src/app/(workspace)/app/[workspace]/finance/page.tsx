import { redirect } from "next/navigation";
import { workspacePath } from "@/lib/workspace/routing";

export default async function FinanceLegacyPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  redirect(workspacePath(workspace, "recettes"));
}
