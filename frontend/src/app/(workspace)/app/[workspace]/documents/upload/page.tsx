import { DocumentUploadView } from "@/features/documents/document-upload-view";

export default async function DocumentUploadPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <DocumentUploadView workspaceSlug={workspace} />;
}
