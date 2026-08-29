import { MemberFinancialHistoryView } from "@/features/members/member-financial-history-view";

export default function MemberFinancialHistoryPage({ params }: Readonly<{ params: { memberId: string } }>) {
  return <MemberFinancialHistoryView memberId={params.memberId} />;
}
