"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, EVENT_TYPES } from "./event-status";

const eventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  event_type: z.enum(["MEETING", "GENERAL_ASSEMBLY", "TRAINING", "CONFERENCE", "CEREMONY", "FUNDRAISING", "COMMUNITY", "SPORT", "CULTURAL", "OTHER"]),
  start_date: z.string().min(1),
  start_time: z.string().min(1),
  end_date: z.string().min(1),
  end_time: z.string().min(1),
  location: z.string().optional(),
  responsible: z.string().optional(),
  status: z.enum(["DRAFT", "PLANNED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED"]),
  capacity: z.coerce.number().min(0).optional(),
  budget: z.coerce.number().min(0),
  project: z.string().optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
}).refine((value) => `${value.end_date}T${value.end_time}` > `${value.start_date}T${value.start_time}`, {
  message: "La fin doit etre posterieure au debut.",
  path: ["end_date"],
});

type EventFormValues = z.infer<typeof eventSchema>;

export function EventForm() {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      event_type: "MEETING",
      start_date: "",
      start_time: "",
      end_date: "",
      end_time: "",
      location: "",
      responsible: "",
      status: "DRAFT",
      capacity: 0,
      budget: 0,
      project: "",
      recurrence: "none",
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(() => undefined)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Titre
          <input className="min-h-10 rounded-md border border-border px-3" {...form.register("title")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Type
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("event_type")}>
            {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date de debut
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("start_date")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Heure de debut
          <input className="min-h-10 rounded-md border border-border px-3" type="time" {...form.register("start_time")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date de fin
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("end_date")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Heure de fin
          <input className="min-h-10 rounded-md border border-border px-3" type="time" {...form.register("end_time")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Lieu
          <input className="min-h-10 rounded-md border border-border px-3" {...form.register("location")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Responsable
          <input className="min-h-10 rounded-md border border-border px-3" placeholder="Utilisateur ou membre du workspace" {...form.register("responsible")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Statut
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("status")}>
            {EVENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Capacite
          <input className="min-h-10 rounded-md border border-border px-3" min={0} type="number" {...form.register("capacity")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Budget prevu
          <input className="min-h-10 rounded-md border border-border px-3" min={0} step="0.01" type="number" {...form.register("budget")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Projet associe
          <input className="min-h-10 rounded-md border border-border px-3" {...form.register("project")} />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Description
        <textarea className="min-h-24 rounded-md border border-border px-3 py-2" {...form.register("description")} />
      </label>
      <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <CalendarPlus className="size-5 text-blue-700" />
          Recurrence
        </div>
        <select className="min-h-10 rounded-md border border-border px-3 text-sm" {...form.register("recurrence")}>
          <option value="none">Aucune</option>
          <option value="daily">Quotidienne</option>
          <option value="weekly">Hebdomadaire</option>
          <option value="monthly">Mensuelle</option>
          <option value="yearly">Annuelle</option>
        </select>
      </div>
      <div className="flex justify-end">
        <Button type="submit"><Save className="size-4" /> Enregistrer</Button>
      </div>
    </form>
  );
}
