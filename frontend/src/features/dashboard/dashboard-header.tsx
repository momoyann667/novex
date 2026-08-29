"use client";

import { CalendarDays, Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PeriodCode } from "./types";

const periods: Array<{ value: PeriodCode; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette annee" },
  { value: "previous_year", label: "Annee precedente" },
];

export function DashboardHeader({
  period,
  todayLabel,
  onPeriodChange,
}: Readonly<{ period: PeriodCode; todayLabel: string; onPeriodChange: (period: PeriodCode) => void }>) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-normal">Dashboard</h1>
        <p className="mt-1 text-slate-600">Vue d'ensemble de votre organisation</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="size-4" />
          {todayLabel}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="min-h-10 rounded-md border border-border bg-white px-3 text-sm"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as PeriodCode)}
          aria-label="Periode du dashboard"
        >
          {periods.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline">
          <RefreshCw className="size-4" />
          Actualiser
        </Button>
        <Button type="button" variant="outline">
          <Download className="size-4" />
          Export
        </Button>
        <Button type="button">
          <Plus className="size-4" />
          Action
        </Button>
      </div>
    </header>
  );
}
