"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ImagePlus, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, EVENT_TYPES } from "./event-status";
import { createEvent, type EventFormPayload } from "./api";

const eventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  event_type: z.enum(["MEETING", "GENERAL_ASSEMBLY", "TRAINING", "CONFERENCE", "SEMINAR", "WORKSHOP", "CEREMONY", "FUNDRAISING", "SOCIAL", "COMMUNITY", "SPORT", "CULTURAL", "OTHER"]),
  start_date: z.string().min(1),
  start_time: z.string().min(1),
  end_date: z.string().min(1),
  end_time: z.string().min(1),
  location: z.string().optional(),
  responsible: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PLANNED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED", "ARCHIVED"]),
  capacity: z.coerce.number().min(0).optional(),
  budget: z.coerce.number().min(0),
  project: z.string().optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
}).refine((value) => `${value.end_date}T${value.end_time}` > `${value.start_date}T${value.start_time}`, {
  message: "La fin doit etre posterieure au debut.",
  path: ["end_date"],
});

type EventFormValues = z.infer<typeof eventSchema>;

const fieldClass = "min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const labelClass = "grid min-w-0 gap-2 text-xs font-black text-slate-700";
const sectionClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
const sectionTitleClass = "border-b border-slate-100 pb-3 text-base font-black text-slate-950";

function toPayload(values: EventFormValues): EventFormPayload {
  const capacity = Number(values.capacity || 0);
  return {
    title: values.title,
    description: values.description,
    event_type: values.event_type,
    status: values.status,
    start_at: `${values.start_date}T${values.start_time}:00`,
    end_at: `${values.end_date}T${values.end_time}:00`,
    timezone: "Africa/Abidjan",
    location_type: "PHYSICAL",
    location: values.location,
    capacity: capacity > 0 ? capacity : null,
    budget: Number(values.budget || 0),
    recurrence: values.recurrence,
    registration_required: values.status === "REGISTRATION_OPEN"
  };
}

export function EventForm({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [coverImage, setCoverImage] = useState<File | null>(null);
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
  const mutation = useMutation({
    mutationFn: (values: EventFormValues) => createEvent(workspaceSlug, { ...toPayload(values), cover_image: coverImage }),
    onSuccess: async (event) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["events-overview", workspaceSlug] });
      router.push(`/app/${workspaceSlug}/events/${event.id}`);
    }
  });

  return (
    <form className="grid w-full gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Informations de base</h2>
        <div className="mt-4 grid gap-4">
          <label className={labelClass}>
            Titre de l'evenement *
            <input className={fieldClass} placeholder="Ex: Assemblee Generale Annuelle" {...form.register("title")} />
          </label>
          <label className={labelClass}>
            Categorie *
            <select className={fieldClass} {...form.register("event_type")}>
              {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Description
            <textarea className={`${fieldClass} min-h-28 resize-none py-3 leading-5`} placeholder="Decrivez l'objectif et le programme de l'evenement..." {...form.register("description")} />
          </label>
          <label className={labelClass}>
            Image de l'evenement
            <span className="grid min-h-28 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-blue-300 hover:bg-blue-50">
              <span className="grid justify-items-center gap-2">
                <span className="grid size-11 place-items-center rounded-full bg-blue-100 text-blue-700">
                  <ImagePlus className="size-5" />
                </span>
                <span className="max-w-full truncate text-sm font-black text-slate-800">{coverImage ? coverImage.name : "Ajouter une image de couverture"}</span>
                <span className="text-xs font-semibold text-slate-500">JPG, PNG ou WEBP</span>
              </span>
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCoverImage(event.target.files?.[0] ?? null)} />
            </span>
          </label>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Date et lieu</h2>
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Date debut *
              <input className={fieldClass} type="date" {...form.register("start_date")} />
            </label>
            <label className={labelClass}>
              Heure debut *
              <input className={fieldClass} type="time" {...form.register("start_time")} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Date fin *
              <input className={fieldClass} type="date" {...form.register("end_date")} />
            </label>
            <label className={labelClass}>
              Heure fin *
              <input className={fieldClass} type="time" {...form.register("end_time")} />
            </label>
          </div>
          <label className={labelClass}>
            Lieu ou adresse
            <input className={fieldClass} placeholder="Rechercher une adresse..." {...form.register("location")} />
          </label>
          <div className="grid gap-2">
            <span className="text-xs font-black text-slate-700">Recurrence</span>
            <div className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-3">
              <CalendarPlus className="size-5 shrink-0 text-blue-700" />
              <select className="min-h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" {...form.register("recurrence")}>
                <option value="none">Aucune</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
                <option value="yearly">Annuelle</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Parametres d'inscription</h2>
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Capacite
              <input className={fieldClass} min={0} type="number" {...form.register("capacity")} />
            </label>
            <label className={labelClass}>
              Budget prevu
              <div className="flex min-h-12 rounded-md border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                <input className="min-w-0 flex-1 rounded-l-md px-3 text-sm font-semibold outline-none" min={0} step="1" type="number" {...form.register("budget")} />
                <span className="grid place-items-center rounded-r-md border-l border-slate-200 px-3 text-xs font-black text-slate-600">FCFA</span>
              </div>
            </label>
          </div>
          <label className={labelClass}>
            Statut
            <select className={fieldClass} {...form.register("status")}>
              {EVENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Projet associe
            <input className={fieldClass} placeholder="Projet optionnel" {...form.register("project")} />
          </label>
          <label className={labelClass}>
            Responsable
            <input className={fieldClass} placeholder="Utilisateur ou membre du workspace" {...form.register("responsible")} />
          </label>
        </div>
      </section>

      {mutation.isError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{mutation.error instanceof Error ? mutation.error.message : "Impossible de creer l'evenement pour le moment."}</p>
      ) : null}
      <div className="sticky bottom-0 -mx-1 bg-white/90 px-1 py-3 backdrop-blur md:static md:bg-transparent md:p-0">
        <Button className="min-h-12 w-full md:w-auto" type="submit" disabled={mutation.isPending}><Save className="size-4" /> {mutation.isPending ? "Enregistrement..." : "Creer l'evenement"}</Button>
      </div>
    </form>
  );
}
