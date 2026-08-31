import { MembershipApplicationDetailView } from "@/features/members/membership-onboarding-view";

export default function MembershipApplicationDetailPage({ params }: Readonly<{ params: { applicationId: string } }>) {
  return <MembershipApplicationDetailView applicationId={params.applicationId} />;
}
