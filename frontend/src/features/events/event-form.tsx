"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ImagePlus, Save } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, EVENT_TYPES } from "./event-status";
import { createEvent, listMemberOptions, listProjectOptions, type EventFormPayload } from "./api";

const eventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  event_type: z.enum(["MEETING", "GENERAL_ASSEMBLY", "TRAINING", "CONFERENCE", "SEMINAR", "WORKSHOP", "CEREMONY", "FUNDRAISING", "SOCIAL", "COMMUNITY", "SPORT", "CULTURAL", "OTHER"]),
  start_date: z.string().min(1),
  start_time: z.string().min(1),
  end_date: z.string().min(1),
  end_time: z.string().min(1),
  location_type: z.enum(["PHYSICAL", "ONLINE"]),
  location: z.string().optional(),
  online_url: z.string().optional(),
  responsible_member: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PLANNED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED", "ARCHIVED"]),
  limit_capacity: z.boolean(),
  capacity: z.coerce.number().min(0).optional(),
  ticket_price: z.coerce.number().min(0).optional(),
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
  const capacity = values.limit_capacity ? Number(values.capacity || 0) : 0;
  const ticketPrice = Number(values.ticket_price || 0);
  return {
    title: values.title,
    description: values.description,
    event_type: values.event_type,
    status: values.status,
    start_at: `${values.start_date}T${values.start_time}:00`,
    end_at: `${values.end_date}T${values.end_time}:00`,
    timezone: "Africa/Abidjan",
    location_type: values.location_type,
    location: values.location_type === "PHYSICAL" ? values.location : "",
    online_url: values.location_type === "ONLINE" ? values.online_url : "",
    capacity: capacity > 0 ? capacity : null,
    budget: Number(values.budget || 0),
    ticket_price: ticketPrice > 0 ? ticketPrice : 0,
    project: values.project ? Number(values.project) : null,
    responsible_member: values.responsible_member ? Number(values.responsible_member) : null,
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
      location_type: "PHYSICAL",
      location: "",
      online_url: "",
      responsible_member: "",
      status: "DRAFT",
      limit_capacity: false,
      capacity: 0,
      ticket_price: 0,
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
  const locationType = useWatch({ control: form.control, name: "location_type" });
  const limitCapacity = useWatch({ control: form.control, name: "limit_capacity" });
  const projectsQuery = useQuery({
    queryKey: ["project-options", workspaceSlug],
    queryFn: () => listProjectOptions(workspaceSlug)
  });
  const membersQuery = useQuery({
    queryKey: ["member-options", workspaceSlug],
    queryFn: () => listMemberOptions(workspaceSlug)
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
          <div className="grid gap-2">
            <span className="text-xs font-black text-slate-700">Format de l'evenement</span>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-1">
              {[
                ["PHYSICAL", "Presentiel"],
                ["ONLINE", "En ligne"]
              ].map(([value, label]) => (
                <label className={`flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-black ${locationType === value ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`} key={value}>
                  <input className="sr-only" type="radio" value={value} {...form.register("location_type")} />
                  {label}
                </label>
              ))}
            </div>
          </div>
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
          {locationType === "ONLINE" ? (
            <label className={labelClass}>
              Lien de l'evenement
              <input className={fieldClass} placeholder="https://..." {...form.register("online_url")} />
            </label>
          ) : (
            <label className={labelClass}>
              Lieu ou adresse
              <input className={fieldClass} placeholder="Rechercher une adresse..." {...form.register("location")} />
            </label>
          )}
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
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800">
            <span>Limiter les places</span>
            <input className="size-5 accent-blue-700" type="checkbox" {...form.register("limit_capacity")} />
          </label>
          {limitCapacity ? (
            <label className={labelClass}>
              Nombre de places attendues
              <input className={fieldClass} min={1} type="number" {...form.register("capacity")} />
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Budget prevu
              <div className="flex min-h-12 rounded-md border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                <input className="min-w-0 flex-1 rounded-l-md px-3 text-sm font-semibold outline-none" min={0} step="1" type="number" {...form.register("budget")} />
                <span className="grid place-items-center rounded-r-md border-l border-slate-200 px-3 text-xs font-black text-slate-600">FCFA</span>
              </div>
            </label>
            <label className={labelClass}>
              Tarif
              <div className="flex min-h-12 rounded-md border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                <input className="min-w-0 flex-1 rounded-l-md px-3 text-sm font-semibold outline-none" min={0} step="1" type="number" placeholder="Vide si gratuit" {...form.register("ticket_price")} />
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
            <select className={fieldClass} {...form.register("project")}>
              <option value="">Aucun projet</option>
              {(projectsQuery.data || []).map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Responsable
            <select className={fieldClass} {...form.register("responsible_member")}>
              <option value="">Aucun responsable</option>
              {(membersQuery.data || []).map((member) => <option value={member.id} key={member.id}>{member.full_name || `${member.first_name} ${member.last_name}`.trim() || member.function}</option>)}
            </select>
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
