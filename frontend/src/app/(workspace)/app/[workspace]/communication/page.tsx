import { CommunicationCenterView } from "@/features/communication/communication-center-view";

export default function CommunicationPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <CommunicationCenterView workspaceSlug={params.workspace} />;
}
