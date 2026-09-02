"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CreditCard, FolderHeart, Loader2, Smartphone, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  initializeSelfPayment,
  listDonationProjects,
  listPayableContributions,
  type DonationProject,
  type PayableContribution
} from "@/features/payments/api";
import { getSubscriptionOverview } from "@/features/subscriptions/api";
import { workspacePath } from "@/lib/workspace/routing";

type Intent = "CONTRIBUTION" | "DONATION";
type PaymentMode = "FULL" | "PARTIAL";

const paymentMethods = [
  { value: "MOBILE_MONEY", label: "Mobile Money", icon: Smartphone },
  { value: "CARD", label: "Carte bancaire", icon: CreditCard },
  { value: "AGGREGATOR", label: "Agregateur", icon: WalletCards },
  { value: "BANK_TRANSFER", label: "Virement", icon: WalletCards }
] as const;

function amountValue(value: string | number) {
  return Number(value || 0);
}

function money(value: string | number, currency = "XOF") {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amountValue(value)) + " " + (currency === "XOF" ? "FCFA" : currency);
}

function linePeriod(item: PayableContribution) {
  if (item.period_label) return item.period_label;
  if (item.period_start && item.period_end) return `${item.period_start} -> ${item.period_end}`;
  return item.due_date ? `Echeance ${item.due_date}` : "Periode non definie";
}

function statusLabel(status: string) {
  return {
    PENDING: "Non payee",
    PARTIALLY_PAID: "Partielle",
    OVERDUE: "En retard",
    PAID: "Payee"
  }[status] || status;
}

function Stepper({ step }: Readonly<{ step: 1 | 2 }>) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-slate-50/95 px-4 py-3 backdrop-blur md:static md:rounded-md md:border md:bg-white">
      <div className="grid grid-cols-[auto_minmax(24px,1fr)_auto] items-center gap-3 text-sm font-black">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-blue-700" : "text-emerald-700"}`}>
          <span className={`grid size-8 place-items-center rounded-full ${step === 1 ? "bg-blue-700 text-white" : "bg-emerald-600 text-white"}`}>
            {step === 1 ? "1" : <Check className="size-4" />}
          </span>
          Cotisations
        </div>
        <span className="h-0.5 rounded-full bg-slate-200" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-blue-700" : "text-slate-400"}`}>
          <span className={`grid size-8 place-items-center rounded-full ${step === 2 ? "bg-blue-700 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>2</span>
          Paiement
        </div>
      </div>
    </div>
  );
}

export function PaymentsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [step, setStep] = useState<1 | 2>(1);
  const [intent, setIntent] = useState<Intent>("CONTRIBUTION");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("FULL");
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [donationAmount, setDonationAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MOBILE_MONEY");
  const [message, setMessage] = useState("");

  const contributionsQuery = useQuery({ queryKey: ["payable-contributions", workspaceSlug], queryFn: () => listPayableContributions(workspaceSlug) });
  const projectsQuery = useQuery({ queryKey: ["payment-donation-projects", workspaceSlug], queryFn: () => listDonationProjects(workspaceSlug) });
  const subscriptionQuery = useQuery({ queryKey: ["subscription-overview", workspaceSlug], queryFn: () => getSubscriptionOverview(workspaceSlug) });
  const contributions = contributionsQuery.data?.results || [];
  const projects = projectsQuery.data || [];
  const selectedContributions = useMemo(() => contributions.filter((item) => selectedIds.includes(item.id)), [contributions, selectedIds]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const currency = selectedContributions[0]?.currency || selectedProject?.currency || "XOF";
  const remainingTotal = selectedContributions.reduce((total, item) => total + amountValue(item.remaining_amount), 0);
  const contributionAmount = selectedContributions.reduce((total, item) => {
    const raw = paymentMode === "FULL" ? item.remaining_amount : partialAmounts[item.id] || item.remaining_amount;
    return total + amountValue(raw);
  }, 0);
  const totalToPay = intent === "DONATION" ? amountValue(donationAmount) : contributionAmount;
  const invalidPartial = selectedContributions.some((item) => {
    const value = amountValue(paymentMode === "FULL" ? item.remaining_amount : partialAmounts[item.id] || item.remaining_amount);
    return value <= 0 || value > amountValue(item.remaining_amount);
  });
  const canContinue = intent === "DONATION" ? Boolean(selectedProjectId) : selectedIds.length > 0;
  const canPayOnlineContributions = subscriptionQuery.data?.subscription.entitlements.ONLINE_CONTRIBUTION_PAYMENT === true;
  const canPay = totalToPay > 0 && !invalidPartial && (intent === "DONATION" ? Boolean(selectedProjectId) : selectedIds.length > 0 && canPayOnlineContributions);
  const mutation = useMutation({
    mutationFn: () => {
      const idempotencyKey = `self-${intent.toLowerCase()}-${Date.now()}`;
      if (intent === "DONATION") {
        return initializeSelfPayment(workspaceSlug, {
          type: "DONATION",
          project: selectedProjectId || 0,
          amount: donationAmount,
          payment_method: paymentMethod,
          idempotency_key: idempotencyKey
        });
      }
      return initializeSelfPayment(workspaceSlug, {
        type: "CONTRIBUTION",
        items: selectedContributions.map((item) => ({
          contribution: item.id,
          amount: String(paymentMode === "FULL" ? amountValue(item.remaining_amount) : amountValue(partialAmounts[item.id] || item.remaining_amount))
        })),
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey
      });
    },
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      setMessage("Le paiement en ligne n'est pas encore disponible. La tentative est creee en attente de configuration provider.");
    },
    onError: (error: Error) => setMessage(error.message)
  });

  function toggleContribution(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function continueToPayment() {
    if (!canContinue) {
      setMessage(intent === "DONATION" ? "Selectionnez un projet a soutenir." : "Selectionnez au moins une cotisation.");
      return;
    }
    setMessage("");
    setStep(2);
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <div className="mx-0 grid w-full gap-4 px-4 py-4 md:mx-auto md:max-w-5xl md:px-6">
        <PageHeader
          title="Paiement"
          description="Payez vos cotisations ou soutenez un projet de votre association."
          actions={<Button asChild variant="outline"><a href={workspacePath(workspaceSlug, "dashboard")}><ArrowLeft className="size-4" /> Retour</a></Button>}
        />

        <Stepper step={step} />

        {message ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{message}</div> : null}

        {step === 1 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950">Que souhaitez-vous payer ?</h2>
              <p className="mt-1 text-sm text-slate-500">Choisissez une intention, puis selectionnez les elements a regler.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button className={`rounded-lg border p-4 text-left ${intent === "CONTRIBUTION" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-border bg-white"}`} type="button" onClick={() => setIntent("CONTRIBUTION")}>
                <CreditCard className="mb-3 size-6" />
                <strong>Cotisations</strong>
                <span className="mt-1 block text-xs text-slate-500">Payer mes cotisations</span>
              </button>
              <button className={`rounded-lg border p-4 text-left ${intent === "DONATION" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-border bg-white"}`} type="button" onClick={() => setIntent("DONATION")}>
                <FolderHeart className="mb-3 size-6" />
                <strong>Dons</strong>
                <span className="mt-1 block text-xs text-slate-500">Soutenir un projet</span>
              </button>
            </div>

            {intent === "CONTRIBUTION" ? (
              <div className="grid gap-3">
                {contributionsQuery.isLoading ? <Loading label="Chargement des cotisations..." /> : null}
                {contributionsQuery.data?.message ? <Empty label={contributionsQuery.data.message} /> : null}
                {!contributionsQuery.isLoading && !contributionsQuery.data?.message && contributions.length === 0 ? <Empty label="Vous etes a jour sur vos cotisations." /> : null}
                {contributions.map((item) => (
                  <ContributionCard key={item.id} item={item} selected={selectedIds.includes(item.id)} onToggle={() => toggleContribution(item.id)} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {projectsQuery.isLoading ? <Loading label="Chargement des projets..." /> : null}
                {!projectsQuery.isLoading && projects.length === 0 ? <Empty label="Aucun projet n'est actuellement ouvert au soutien." /> : null}
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} selected={project.id === selectedProjectId} onSelect={() => setSelectedProjectId(project.id)} />
                ))}
              </div>
            )}

            <Button className="min-h-12 w-full" type="button" disabled={!canContinue} onClick={continueToPayment}>
              Continuer <ArrowRight className="size-4" />
            </Button>
          </section>
        ) : (
          <section className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">{intent === "DONATION" ? "Soutenir le projet" : "Paiement"}</h2>
                <p className="mt-1 text-sm text-slate-500">Verification backend obligatoire avant toute confirmation.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Retour</Button>
            </div>

            <Card>
              <CardContent className="grid gap-4 p-4">
                <h3 className="font-black text-slate-950">Recapitulatif</h3>
                {intent === "CONTRIBUTION" ? (
                  <>
                    <div className="grid gap-3">
                      {selectedContributions.map((item) => (
                        <div className="grid gap-3 rounded-md bg-slate-50 p-3" key={item.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <strong>{item.campaign_name}</strong>
                              <p className="text-xs text-slate-500">Reste: {money(item.remaining_amount, item.currency)}</p>
                            </div>
                            <span className="font-black">{money(paymentMode === "FULL" ? item.remaining_amount : partialAmounts[item.id] || item.remaining_amount, item.currency)}</span>
                          </div>
                          {paymentMode === "PARTIAL" ? (
                            <input
                              className="min-h-11 rounded-md border border-border px-3 text-base font-semibold outline-none"
                              inputMode="decimal"
                              value={partialAmounts[item.id] ?? String(amountValue(item.remaining_amount))}
                              onChange={(event) => setPartialAmounts((current) => ({ ...current, [item.id]: event.target.value }))}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className={`rounded-md border p-3 text-sm font-black ${paymentMode === "FULL" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-border bg-white"}`} type="button" onClick={() => setPaymentMode("FULL")}>Payer tout</button>
                      <button className={`rounded-md border p-3 text-sm font-black ${paymentMode === "PARTIAL" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-border bg-white"}`} type="button" onClick={() => setPaymentMode("PARTIAL")}>Payer une partie</button>
                    </div>
                    <div className="rounded-md bg-slate-950 p-4 text-white">
                      <p className="text-xs text-slate-300">Montant restant</p>
                      <strong className="text-2xl">{money(remainingTotal, currency)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Projet selectionne</p>
                      <strong>{selectedProject?.name}</strong>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold">
                      Montant du don
                      <input className="min-h-12 rounded-md border border-border px-3 text-base outline-none" inputMode="decimal" value={donationAmount} onChange={(event) => setDonationAmount(event.target.value)} placeholder="10000" />
                    </label>
                  </>
                )}

                <label className="grid gap-2 text-sm font-semibold">
                  Moyen de paiement
                  <select className="min-h-12 rounded-md border border-border px-3 outline-none" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </label>
              </CardContent>
            </Card>

            {invalidPartial ? <div className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">Le montant doit etre superieur a 0 et inferieur ou egal au reste a payer.</div> : null}
            {intent === "CONTRIBUTION" && !canPayOnlineContributions ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Le paiement en ligne des cotisations est disponible avec NOVEX Pro.
                <a className="mt-2 block font-black text-blue-700" href={workspacePath(workspaceSlug, "settings/subscription")}>Passer a NOVEX Pro</a>
              </div>
            ) : null}
            <Button className="min-h-12 w-full" type="button" disabled={!canPay || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Payer {money(totalToPay, currency)}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function Loading({ label }: Readonly<{ label: string }>) {
  return <div className="flex min-h-24 items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-slate-500"><Loader2 className="mr-2 size-4 animate-spin" /> {label}</div>;
}

function Empty({ label }: Readonly<{ label: string }>) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">{label}</div>;
}

function ContributionCard({ item, selected, onToggle }: Readonly<{ item: PayableContribution; selected: boolean; onToggle: () => void }>) {
  return (
    <button className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm ${selected ? "border-blue-600 ring-2 ring-blue-100" : "border-border"}`} type="button" onClick={onToggle}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">{item.campaign_name}</h3>
          <p className="mt-1 text-xs text-slate-500">Periode: {linePeriod(item)}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${item.status === "OVERDUE" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{statusLabel(item.status)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Total" value={money(item.amount_due, item.currency)} />
        <Metric label="Deja paye" value={money(item.amount_paid, item.currency)} />
        <Metric label="Reste" value={money(item.remaining_amount, item.currency)} strong />
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-black text-slate-800">
        <span className={`grid size-5 place-items-center rounded border ${selected ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"}`}>{selected ? <Check className="size-3" /> : null}</span>
        Selectionner
      </div>
    </button>
  );
}

function ProjectCard({ project, selected, onSelect }: Readonly<{ project: DonationProject; selected: boolean; onSelect: () => void }>) {
  const rate = amountValue(project.budget) > 0 ? Math.min(100, Math.round((amountValue(project.funding_received) / amountValue(project.budget)) * 100)) : project.progress;
  return (
    <button className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm ${selected ? "border-blue-600 ring-2 ring-blue-100" : "border-border"}`} type="button" onClick={onSelect}>
      {project.image ? <img className="mb-3 h-32 w-full rounded-md object-cover" src={project.image} alt="" /> : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">{project.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description || "Projet de l'association."}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{project.status_label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Objectif" value={money(project.budget, project.currency)} />
        <Metric label="Deja collecte" value={money(project.funding_received, project.currency)} strong />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-black"><span>Progression</span><span>{rate}%</span></div>
        <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${rate}%` }} /></div>
      </div>
    </button>
  );
}

function Metric({ label, value, strong = false }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <strong className={strong ? "text-blue-700" : "text-slate-950"}>{value}</strong>
    </div>
  );
}
