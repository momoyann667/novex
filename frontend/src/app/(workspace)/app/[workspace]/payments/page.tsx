import { PaymentsView } from "@/features/payments/payments-view";

export default async function PaymentsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <PaymentsView workspaceSlug={workspace} />;
}
