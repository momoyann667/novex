import { MembersView } from "@/features/members/members-view";

export default function MembersPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <MembersView workspaceSlug={params.workspace} />;
}
