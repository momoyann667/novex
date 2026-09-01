import { CommunicationCenterView } from "@/features/communication/communication-center-view";

export default async function CommunicationPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <CommunicationCenterView workspaceSlug={workspace} />;
}
