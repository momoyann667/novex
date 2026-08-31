import { PublicMembershipFormView } from "@/features/members/membership-onboarding-view";

export default function PublicMembershipPage({ params }: Readonly<{ params: { slug: string } }>) {
  return <PublicMembershipFormView slug={params.slug} />;
}
