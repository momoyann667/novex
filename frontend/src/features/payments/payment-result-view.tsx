"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { apiFetch } from "@/lib/api/client";
import { workspacePath } from "@/lib/workspace/routing";

type PaymentResult = {
  reference: string;
  status: string;
  amount: string;
  currency: string;
  receipt_reference?: string;
};

export function PaymentResultView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const params = useSearchParams();
  const reference = params.get("reference");
  const [payment, setPayment] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reference) {
      setError("Reference paiement manquante.");
      return;
    }
    apiFetch<PaymentResult>(`/payments/result/?reference=${encodeURIComponent(reference)}`, { headers: { "X-Workspace": workspaceSlug } })
      .then(setPayment)
      .catch((err: Error) => setError(err.message));
  }, [reference, workspaceSlug]);

  const isSuccess = payment?.status === "SUCCESS";
  const isFailed = payment?.status === "FAILED";
  const isCancelled = payment?.status === "CANCELLED";
  const title = isSuccess ? "Paiement reussi" : isFailed ? "Paiement echoue" : isCancelled ? "Paiement annule" : "Paiement en verification";

  return (
    <div className="grid gap-6">
      <PageHeader title={title} description="Statut relu depuis le backend NOVEX." />
      <Card>
        <CardContent className="grid gap-4 p-6">
          {!payment && !error ? (
            <div className="flex items-center gap-3 text-sm text-slate-600"><Loader2 className="size-5 animate-spin text-blue-700" /> Verification du paiement...</div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-3 text-sm text-red-700"><AlertCircle className="size-5" /> {error}</div>
          ) : null}
          {payment ? (
            <div className="flex items-start gap-3">
              {isSuccess ? <CheckCircle2 className="size-6 text-emerald-700" /> : isFailed || isCancelled ? <AlertCircle className="size-6 text-red-700" /> : <Loader2 className="size-6 text-blue-700" />}
              <div>
                <h2 className="font-semibold">{isSuccess ? "Paiement confirme" : isFailed ? "Le provider a signale un echec" : isCancelled ? "Le paiement a ete annule" : "Paiement en cours de verification"}</h2>
                <p className="mt-1 text-sm text-slate-500">Reference {payment.reference} - {payment.amount} {payment.currency} - {payment.status}</p>
                {payment.receipt_reference ? <p className="mt-2 text-sm text-slate-600">Recu {payment.receipt_reference}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(isFailed || isCancelled) ? (
                    <Button asChild><Link href={workspacePath(workspaceSlug, "payments")}><RotateCcw className="size-4" /> Reessayer</Link></Button>
                  ) : null}
                  <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, "payments")}><ArrowLeft className="size-4" /> Retour aux paiements</Link></Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
