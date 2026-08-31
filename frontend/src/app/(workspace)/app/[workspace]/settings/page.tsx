import { WorkspaceSettingsView } from "@/features/workspace/workspace-settings-view";

export default async function WorkspaceSettingsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <WorkspaceSettingsView workspaceSlug={workspace} />;
}
