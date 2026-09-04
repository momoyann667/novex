import { PublicMembershipFormView } from "@/features/members/membership-onboarding-view";

export default async function PublicMembershipPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  return <PublicMembershipFormView slug={slug} />;
}
