import type { ReactNode } from "react";
import { AssociationShell } from "@/components/layout/association-shell";

export default async function WorkspaceLayout({
  children,
  params
}: Readonly<{ children: ReactNode; params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <AssociationShell workspaceSlug={workspace}>{children}</AssociationShell>;
}
