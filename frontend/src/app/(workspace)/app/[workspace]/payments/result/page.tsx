import { Suspense } from "react";
import { PaymentResultView } from "@/features/payments/payment-result-view";

export default async function PaymentResultPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return (
    <Suspense fallback={null}>
      <PaymentResultView workspaceSlug={workspace} />
    </Suspense>
  );
}
