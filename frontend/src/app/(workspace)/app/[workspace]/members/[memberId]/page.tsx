import { MemberDetailView } from "@/features/members/member-detail-view";

export default function MemberDetailPage({ params }: Readonly<{ params: { memberId: string } }>) {
  return <MemberDetailView memberId={params.memberId} />;
}
