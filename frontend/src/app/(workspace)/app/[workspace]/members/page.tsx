import { MembersView } from "@/features/members/members-view";

export default async function MembersPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <MembersView workspaceSlug={workspace} />;
}
