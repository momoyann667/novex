"use client";

import { useMemo, useState } from "react";
import { CreditCard, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { DashboardHeader } from "./dashboard-header";
import { KpiCard } from "./kpi-card";
import { EmptyDashboard } from "./empty-dashboard";
import { FinancialOverview } from "./financial-overview";
import { ContributionOverview } from "./contribution-overview";
import { DashboardSecondaryWidgets } from "./dashboard-secondary-widgets";
import { emptyDashboardOverview } from "./data";
import type { DashboardOverview, PeriodCode } from "./types";

export function DashboardView({ initialData = emptyDashboardOverview }: Readonly<{ initialData?: DashboardOverview }>) {
  const [period, setPeriod] = useState<PeriodCode>(initialData.period.code);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("fr-CI", { dateStyle: "full" }).format(new Date(initialData.period.server_now)),
    [initialData.period.server_now],
  );

  return (
    <div className="grid gap-6">
      <DashboardHeader period={period} todayLabel={todayLabel} onPeriodChange={setPeriod} />
      {initialData.empty_state ? <EmptyDashboard /> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Solde actuel" value={initialData.kpis.finance.current_balance} detail="Solde courant, hors filtre periode" icon={<Wallet className="size-5" />} />
        <KpiCard title="Recettes" value={initialData.kpis.finance.revenues} detail={period === "month" ? "Flux de la periode" : initialData.period.label} trend="up" icon={<TrendingUp className="size-5" />} />
        <KpiCard title="Depenses" value={initialData.kpis.finance.expenses} detail="Flux de la periode" trend="neutral" icon={<TrendingDown className="size-5" />} />
        <KpiCard title="Cotisations" value={initialData.kpis.contributions.collected} detail={`${initialData.kpis.contributions.recovery_rate}% de l'objectif`} icon={<CreditCard className="size-5" />} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total membres" value={initialData.kpis.members.total} icon={<Users className="size-5" />} />
        <KpiCard title="Membres actifs" value={initialData.kpis.members.active} detail={`${initialData.kpis.members.active_rate}%`} />
        <KpiCard title="Nouveaux membres" value={`+${initialData.kpis.members.new_members}`} detail={initialData.period.label} />
        <KpiCard title="Cotisation a jour" value={initialData.kpis.members.contribution_current} detail={`${initialData.kpis.members.contribution_current_rate}%`} />
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <FinancialOverview data={initialData} />
        <ContributionOverview data={initialData} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardSecondaryWidgets data={initialData} />
      </section>
      <p className="text-sm text-slate-500">Derniere mise a jour : {new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium", timeStyle: "short" }).format(new Date(initialData.last_updated_at))}</p>
    </div>
  );
}
