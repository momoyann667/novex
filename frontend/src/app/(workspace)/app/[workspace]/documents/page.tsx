import { DocumentsView } from "@/features/documents/documents-view";

export default async function DocumentsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <DocumentsView workspaceSlug={workspace} />;
}
