import { MemberInvitationsView } from "@/features/members/membership-onboarding-view";

export default async function MemberInvitationsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <MemberInvitationsView workspaceSlug={workspace} />;
}
