import { ContributionDetailView } from "@/features/contributions/contribution-detail-view";

export default function ContributionDetailPage({ params }: Readonly<{ params: { contributionId: string } }>) {
  return <ContributionDetailView contributionId={params.contributionId} />;
}
