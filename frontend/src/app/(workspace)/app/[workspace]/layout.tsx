import type { ReactNode } from "react";
import { AssociationShell } from "@/components/layout/association-shell";

export default function WorkspaceLayout({
  children,
  params
}: Readonly<{ children: ReactNode; params: { workspace: string } }>) {
  return <AssociationShell workspaceSlug={params.workspace}>{children}</AssociationShell>;
}
