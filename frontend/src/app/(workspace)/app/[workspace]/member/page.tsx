import { MemberSpaceView } from "@/features/members/member-space-view";

export default async function MemberSpacePage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <MemberSpaceView workspaceSlug={workspace} />;
}
