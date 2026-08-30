import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const income = ["Cotisations", "Dons", "Subventions", "Sponsors", "Ventes", "Billetterie", "Prestations", "Autres"];
const expenses = ["Transport", "Communication", "Fournitures", "Location", "Evenements", "Projets", "Prestations", "Maintenance", "Administration", "Autres"];

export function FinanceCategoriesView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Categories finance" description="Categories personnalisables sans suppression destructive." actions={<Button type="button"><Plus className="size-4" /> Categorie</Button>} />
      <section className="grid gap-4 lg:grid-cols-2">
        {[["Recettes", income], ["Depenses", expenses]].map(([title, items]) => (
          <Card key={String(title)}>
            <CardContent className="grid gap-3 p-5">
              <h2 className="font-semibold">{title}</h2>
              {(items as string[]).map((item) => <div key={item} className="flex items-center justify-between rounded-md border border-border p-3 text-sm"><span>{item}</span><Button type="button" variant="outline"><Archive className="size-4" /> Archiver</Button></div>)}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
