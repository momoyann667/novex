import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkspaceDashboardPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Dashboard" description="Vue initiale du workspace actif." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Membres", "0", "Ajouter un membre"],
          ["Cotisations", "0 FCFA", "Creer une campagne"],
          ["Projets", "0", "Creer un projet"],
          ["Evenements", "0", "Creer un evenement"]
        ].map(([title, value, action]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
              <p className="mt-2 text-sm text-slate-500">{action}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
