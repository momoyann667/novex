import { SupportView } from "@/features/support/support-view";

export default async function SupportPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <SupportView workspaceSlug={workspace} />;
}
