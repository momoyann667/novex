import { DocumentUploadView } from "@/features/documents/document-upload-view";

export default async function DocumentUploadPage({ params, searchParams }: Readonly<{ params: Promise<{ workspace: string }>; searchParams: Promise<{ folder?: string }> }>) {
  const { workspace } = await params;
  const { folder } = await searchParams;
  return <DocumentUploadView workspaceSlug={workspace} initialFolderId={folder || ""} />;
}
