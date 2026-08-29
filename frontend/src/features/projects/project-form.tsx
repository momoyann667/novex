"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "./project-status";

const projectSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional(),
  objectives: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  responsible: z.string().optional(),
  budget: z.coerce.number().min(0),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["DRAFT", "PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  partners: z.string().optional(),
  notes: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectForm() {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      objectives: "",
      start_date: "",
      end_date: "",
      responsible: "",
      budget: 0,
      category: "",
      priority: "MEDIUM",
      status: "DRAFT",
      partners: "",
      notes: "",
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(() => undefined)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Nom du projet
          <input className="min-h-10 rounded-md border border-border px-3" {...form.register("name")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Responsable
          <input className="min-h-10 rounded-md border border-border px-3" placeholder="Utilisateur ou membre du workspace" {...form.register("responsible")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date de debut
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("start_date")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date de fin prevue
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("end_date")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Budget prevu
          <input className="min-h-10 rounded-md border border-border px-3" min={0} step="0.01" type="number" {...form.register("budget")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Categorie
          <input className="min-h-10 rounded-md border border-border px-3" {...form.register("category")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Priorite
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("priority")}>
            {PROJECT_PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Statut
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("status")}>
            {PROJECT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Description
        <textarea className="min-h-24 rounded-md border border-border px-3 py-2" {...form.register("description")} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Objectifs
        <textarea className="min-h-24 rounded-md border border-border px-3 py-2" {...form.register("objectives")} />
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Partenaires
          <textarea className="min-h-20 rounded-md border border-border px-3 py-2" {...form.register("partners")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Notes
          <textarea className="min-h-20 rounded-md border border-border px-3 py-2" {...form.register("notes")} />
        </label>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <ImagePlus className="size-5 text-blue-700" />
          Image ou logo du projet
        </div>
        <Button type="button" variant="outline">Choisir</Button>
      </div>
      <div className="flex justify-end">
        <Button type="submit"><Save className="size-4" /> Enregistrer</Button>
      </div>
    </form>
  );
}
