import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "./progress-ring";
import type { DashboardOverview } from "./types";

export function ContributionOverview({ data }: Readonly<{ data: DashboardOverview }>) {
  return (
    <Card className="xl:col-span-5">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Suivi des cotisations</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ProgressRing value={data.kpis.contributions.recovery_rate} label="Taux de recouvrement" />
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Objectif</div>
            <strong>{data.kpis.contributions.objective ?? "Masque"}</strong>
          </div>
          <div>
            <div className="text-slate-500">Collecte</div>
            <strong>{data.kpis.contributions.collected ?? "Masque"}</strong>
          </div>
          <div>
            <div className="text-slate-500">Restant</div>
            <strong>{data.kpis.contributions.remaining ?? "Masque"}</strong>
          </div>
        </div>
        <Button type="button" variant="outline">Voir les cotisations</Button>
      </CardContent>
    </Card>
  );
}
