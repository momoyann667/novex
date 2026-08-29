import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "./types";

export function FinancialOverview({ data }: Readonly<{ data: DashboardOverview }>) {
  const hasSeries = data.series.financial_overview.length > 0;

  return (
    <Card className="xl:col-span-7">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Evolution financiere</CardTitle>
      </CardHeader>
      <CardContent>
        {hasSeries ? (
          <div className="h-72 rounded-md border border-border bg-slate-50" aria-label="Graphique recettes depenses solde net" />
        ) : (
          <div className="grid h-72 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-center">
            <div>
              <div className="font-semibold">Aucune donnee financiere pour cette periode.</div>
              <p className="mt-1 text-sm text-slate-500">Les courbes apparaitront apres les premieres recettes et depenses.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
