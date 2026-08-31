import { MemberDetailView } from "@/features/members/member-detail-view";

export default async function MemberDetailPage({ params }: Readonly<{ params: Promise<{ memberId: string }> }>) {
  const { memberId } = await params;
  return <MemberDetailView memberId={memberId} />;
}
