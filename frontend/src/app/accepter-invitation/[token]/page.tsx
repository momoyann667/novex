import { InvitationAcceptanceView } from "@/features/members/membership-onboarding-view";

export default async function AcceptInvitationPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <InvitationAcceptanceView token={token} />;
}
