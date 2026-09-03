import { WorkspaceSettingsView, type SettingsSection } from "@/features/workspace/workspace-settings-view";

const sections = new Set(["association", "members", "finance", "users", "security", "subscription", "saas-payments"]);
const sectionAliases: Record<string, SettingsSection> = {
  abonnement: "subscription",
  abonnements: "subscription",
  subscriptions: "subscription",
  billing: "subscription",
  paiement: "saas-payments",
  paiements: "saas-payments",
  "paiement-saas": "saas-payments",
  "paiements-saas": "saas-payments",
  "saas-payment": "saas-payments",
  "saas-payments": "saas-payments",
};

export default async function WorkspaceSettingsSectionPage({ params }: Readonly<{ params: Promise<{ workspace: string; section: string }> }>) {
  const { workspace, section } = await params;
  const normalized = sectionAliases[section] || section;
  const activeSection = sections.has(normalized) ? (normalized as SettingsSection) : "association";
  return <WorkspaceSettingsView workspaceSlug={workspace} section={activeSection} />;
}
