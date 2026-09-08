import { DocumentsView } from "@/features/documents/documents-view";

export default async function DocumentsPage({ params, searchParams }: Readonly<{ params: Promise<{ workspace: string }>; searchParams: Promise<{ folder?: string }> }>) {
  const { workspace } = await params;
  const { folder } = await searchParams;
  return <DocumentsView workspaceSlug={workspace} initialFolderId={folder || ""} />;
}
