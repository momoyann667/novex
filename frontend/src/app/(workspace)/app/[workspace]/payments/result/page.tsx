import { Suspense } from "react";
import { PaymentResultView } from "@/features/payments/payment-result-view";

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResultView />
    </Suspense>
  );
}
