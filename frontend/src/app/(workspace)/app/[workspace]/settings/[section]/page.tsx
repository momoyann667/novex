import { WorkspaceSettingsView, type SettingsSection } from "@/features/workspace/workspace-settings-view";

const sections = new Set(["association", "members", "finance", "users", "security", "subscription", "saas-payments"]);

export default async function WorkspaceSettingsSectionPage({ params }: Readonly<{ params: Promise<{ workspace: string; section: string }> }>) {
  const { workspace, section } = await params;
  const activeSection = sections.has(section) ? (section as SettingsSection) : "association";
  return <WorkspaceSettingsView workspaceSlug={workspace} section={activeSection} />;
}
