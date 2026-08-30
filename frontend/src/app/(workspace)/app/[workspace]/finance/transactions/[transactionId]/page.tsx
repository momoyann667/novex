import { FinanceTransactionDetailView } from "@/features/finance/finance-transaction-detail-view";

export default function FinanceTransactionDetailPage({ params }: Readonly<{ params: { transactionId: string } }>) {
  return <FinanceTransactionDetailView transactionId={params.transactionId} />;
}
