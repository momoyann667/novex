import { PaymentDetailView } from "@/features/payments/payment-detail-view";

export default function PaymentDetailPage({ params }: Readonly<{ params: { paymentId: string } }>) {
  return <PaymentDetailView paymentId={params.paymentId} />;
}
