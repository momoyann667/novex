import { CreditCard, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyDashboard() {
  return (
    <Card className="grid gap-5 p-6 md:p-8">
      <div>
        <p className="text-sm font-semibold text-blue-700">Bienvenue sur NOVEX</p>
        <h2 className="mt-2 text-2xl font-bold tracking-normal">Commencez par ajouter vos membres et vos premieres operations.</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Le dashboard restera sobre tant que les modules metier ne contiennent pas de donnees reelles.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button">
          <UserPlus className="size-4" />
          Ajouter un membre
        </Button>
        <Button type="button" variant="outline">
          <Plus className="size-4" />
          Enregistrer une recette
        </Button>
        <Button type="button" variant="outline">
          <CreditCard className="size-4" />
          Creer une cotisation
        </Button>
      </div>
    </Card>
  );
}
