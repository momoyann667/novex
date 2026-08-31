import { MemberSpaceView } from "@/features/members/member-space-view";

export default function MemberSpacePage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <MemberSpaceView workspaceSlug={params.workspace} />;
}
