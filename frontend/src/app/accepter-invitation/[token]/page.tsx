import { InvitationAcceptanceView } from "@/features/members/membership-onboarding-view";

export default function AcceptInvitationPage({ params }: Readonly<{ params: { token: string } }>) {
  return <InvitationAcceptanceView token={params.token} />;
}
