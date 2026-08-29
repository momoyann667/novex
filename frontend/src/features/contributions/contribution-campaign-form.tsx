"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_TARGET_MODES, CONTRIBUTION_CAMPAIGN_STATUSES, CONTRIBUTION_PERIODICITIES, CONTRIBUTION_TYPES } from "./contribution-status";

const campaignSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  contribution_type: z.enum(["MEMBERSHIP", "MONTHLY", "QUARTERLY", "YEARLY", "SPECIAL", "EVENT", "PROJECT", "OTHER"]),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  periodicity: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  period_start: z.string().optional(),
  due_date: z.string().optional(),
  target_mode: z.enum(["ALL_ACTIVE", "CATEGORY", "SELECTED", "SEGMENT"]),
  is_required: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "CANCELLED"]),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

export function ContributionCampaignForm() {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      contribution_type: "MONTHLY",
      amount: 0,
      currency: "XOF",
      periodicity: "MONTHLY",
      period_start: "",
      due_date: "",
      target_mode: "ALL_ACTIVE",
      is_required: true,
      status: "DRAFT",
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(() => undefined)}>
      <label className="grid gap-1 text-sm font-medium">
        Nom
        <input className="min-h-10 rounded-md border border-border px-3" {...form.register("name")} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Type
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("contribution_type")}>
            {CONTRIBUTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Periodicite
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("periodicity")}>
            {CONTRIBUTION_PERIODICITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Montant
          <input className="min-h-10 rounded-md border border-border px-3" min={0} step="0.01" type="number" {...form.register("amount")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Devise
          <input className="min-h-10 rounded-md border border-border px-3" maxLength={3} {...form.register("currency")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date de debut
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("period_start")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Echeance
          <input className="min-h-10 rounded-md border border-border px-3" type="date" {...form.register("due_date")} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Membres concernes
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("target_mode")}>
            {CAMPAIGN_TARGET_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Statut
          <select className="min-h-10 rounded-md border border-border px-3" {...form.register("status")}>
            {CONTRIBUTION_CAMPAIGN_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Description
        <textarea className="min-h-20 rounded-md border border-border px-3 py-2" {...form.register("description")} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" {...form.register("is_required")} />
        Obligatoire
      </label>
      <div className="flex justify-end">
        <Button type="submit"><Save className="size-4" /> Creer</Button>
      </div>
    </form>
  );
}
