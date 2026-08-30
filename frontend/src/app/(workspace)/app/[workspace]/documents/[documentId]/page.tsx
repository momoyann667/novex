import { DocumentDetailView } from "@/features/documents/document-detail-view";

export default async function DocumentDetailPage({ params }: Readonly<{ params: Promise<{ workspace: string; documentId: string }> }>) {
  const { workspace, documentId } = await params;
  return <DocumentDetailView documentId={documentId} workspaceSlug={workspace} />;
}
