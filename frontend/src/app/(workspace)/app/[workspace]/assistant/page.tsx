import { AssistantView } from "@/features/assistant/assistant-view";

export default async function AssistantPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <AssistantView workspaceSlug={workspace} />;
}
