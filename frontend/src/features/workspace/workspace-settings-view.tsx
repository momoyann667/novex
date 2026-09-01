"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, CheckCircle2, CreditCard, FileText, Landmark, Palette, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspaceSettings, updateWorkspaceSettings, type WorkspaceSettingsResource, type WorkspaceSettingsUpdatePayload } from "./api";

type SettingsTab = "general" | "preferences" | "finance" | "notifications" | "security";

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "preferences", label: "Preferences" },
  { id: "finance", label: "Finance" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Securite" }
];

const fieldClass = "min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const labelClass = "grid gap-2 text-sm font-black text-slate-700";
const cardClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";

const defaultSettings: WorkspaceSettingsResource = {
  workspace_slug: "",
  workspace_name: "",
  organization_type: "association",
  logo: null,
  currency: "XOF",
  country: "CI",
  city: "",
  description: "",
  profile: { legal_name: "", address: "", contact_email: "", contact_phone: "", website_url: "" },
  subscription: null,
  acronym: "",
  registration_number: "",
  region: "",
  founded_on: null,
  primary_contact_name: "",
  primary_contact_email: "",
  primary_contact_phone: "",
  primary_contact_function: "",
  timezone: "Africa/Abidjan",
  language: "fr",
  date_format: "DD/MM/YYYY",
  money_format: { thousand_separator: " ", decimals: 0, symbol_position: "after" },
  theme: "light",
  primary_color: "#0F7FF2",
  secondary_color: "#3B82F6",
  finance_preferences: { expense_validation_enabled: true, income_validation_enabled: false },
  contribution_preferences: { periodicity: "MONTHLY", due_day: 30, reminders: ["before_due", "due_day", "after_due"] },
  notification_preferences: { channels: { in_app: true, email: true, sms: false, whatsapp: false } },
  member_preferences: {},
  project_preferences: {},
  event_preferences: {},
  document_preferences: {},
  integration_states: {},
  security_preferences: {}
};

function boolSetting(source: Record<string, unknown>, key: string) {
  return Boolean(source[key]);
}

function nestedBool(source: Record<string, unknown>, group: string, key: string) {
  const nested = source[group];
  if (!nested || typeof nested !== "object") return false;
  return Boolean((nested as Record<string, unknown>)[key]);
}

export function WorkspaceSettingsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [form, setForm] = useState<WorkspaceSettingsResource>(defaultSettings);
  const [notice, setNotice] = useState("");
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug)
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({ ...defaultSettings, ...settingsQuery.data, profile: { ...defaultSettings.profile, ...settingsQuery.data.profile } });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: WorkspaceSettingsUpdatePayload) => updateWorkspaceSettings(workspaceSlug, payload),
    onSuccess: async (settings) => {
      setForm({ ...defaultSettings, ...settings, profile: { ...defaultSettings.profile, ...settings.profile } });
      setNotice(`Parametres de ${settings.workspace_name} enregistres.`);
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceSlug] });
      if (settings.workspace_slug && settings.workspace_slug !== workspaceSlug) {
        router.replace(`/app/${settings.workspace_slug}/settings`);
      }
    }
  });

  function update<K extends keyof WorkspaceSettingsResource>(key: K, value: WorkspaceSettingsResource[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProfile<K extends keyof WorkspaceSettingsResource["profile"]>(key: K, value: WorkspaceSettingsResource["profile"][K]) {
    setForm((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }

  function updateJson(section: "finance_preferences" | "contribution_preferences" | "notification_preferences" | "event_preferences" | "document_preferences", key: string, value: unknown) {
    setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }

  function updateChannel(key: string, value: boolean) {
    setForm((current) => ({
      ...current,
      notification_preferences: {
        ...current.notification_preferences,
        channels: { ...(current.notification_preferences.channels as Record<string, unknown>), [key]: value }
      }
    }));
  }

  function save() {
    updateMutation.mutate({
      workspace_name: form.workspace_name,
      organization_type: form.organization_type,
      currency: form.currency,
      country: form.country,
      city: form.city,
      description: form.description,
      profile: form.profile,
      acronym: form.acronym,
      registration_number: form.registration_number,
      region: form.region,
      founded_on: form.founded_on,
      primary_contact_name: form.primary_contact_name,
      primary_contact_email: form.primary_contact_email,
      primary_contact_phone: form.primary_contact_phone,
      primary_contact_function: form.primary_contact_function,
      timezone: form.timezone,
      language: form.language,
      date_format: form.date_format,
      money_format: form.money_format,
      theme: form.theme,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      finance_preferences: form.finance_preferences,
      contribution_preferences: form.contribution_preferences,
      notification_preferences: form.notification_preferences,
      member_preferences: form.member_preferences,
      project_preferences: form.project_preferences,
      event_preferences: form.event_preferences,
      document_preferences: form.document_preferences,
      security_preferences: form.security_preferences
    });
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Parametres</h1>
          <p className="mt-2 max-w-md text-sm font-semibold leading-5 text-slate-600">Configurez l'identite, les preferences et les regles de votre association.</p>
        </div>
        <Button className="hidden min-h-11 px-4 md:inline-flex" type="button" onClick={save} disabled={updateMutation.isPending}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      </header>

      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {notice}
        </div>
      ) : null}
      {settingsQuery.isError || updateMutation.isError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Impossible de charger ou enregistrer les parametres.</p>
      ) : null}

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Sections des parametres">
        {tabs.map((tab) => (
          <button className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black ${activeTab === tab.id ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`} key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {settingsQuery.isLoading ? (
        <section className={`${cardClass} mt-5`}>
          <p className="text-sm font-bold text-slate-500">Chargement des parametres...</p>
        </section>
      ) : null}

      {activeTab === "general" ? (
        <section className="mt-5 grid gap-4">
          <div className={cardClass}>
            <h2 className="flex items-center gap-2 text-lg font-black"><Building2 className="size-5 text-blue-700" /> Identite association</h2>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>Nom de l'association<input className={fieldClass} value={form.workspace_name} onChange={(event) => update("workspace_name", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Sigle<input className={fieldClass} value={form.acronym} onChange={(event) => update("acronym", event.target.value)} /></label>
                <label className={labelClass}>Type<select className={fieldClass} value={form.organization_type} onChange={(event) => update("organization_type", event.target.value)}>
                  <option value="association">Association</option>
                  <option value="ong">ONG</option>
                  <option value="syndicat">Syndicat</option>
                  <option value="cooperative">Cooperative</option>
                  <option value="club">Club</option>
                  <option value="community">Organisation communautaire</option>
                </select></label>
              </div>
              <label className={labelClass}>Description<textarea className={`${fieldClass} min-h-24 py-3`} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
              <label className={labelClass}>Numero d'enregistrement<input className={fieldClass} value={form.registration_number} onChange={(event) => update("registration_number", event.target.value)} /></label>
            </div>
          </div>
          <div className={cardClass}>
            <h2 className="text-lg font-black">Coordonnees</h2>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>Email<input className={fieldClass} type="email" value={form.profile.contact_email} onChange={(event) => updateProfile("contact_email", event.target.value)} /></label>
              <label className={labelClass}>Telephone<input className={fieldClass} value={form.profile.contact_phone} onChange={(event) => updateProfile("contact_phone", event.target.value)} /></label>
              <label className={labelClass}>Adresse<textarea className={`${fieldClass} min-h-20 py-3`} value={form.profile.address} onChange={(event) => updateProfile("address", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Ville<input className={fieldClass} value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
                <label className={labelClass}>Pays<input className={fieldClass} maxLength={2} value={form.country} onChange={(event) => update("country", event.target.value.toUpperCase())} /></label>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "preferences" ? (
        <section className={`${cardClass} mt-5`}>
          <h2 className="flex items-center gap-2 text-lg font-black"><Palette className="size-5 text-blue-700" /> Preferences</h2>
          <div className="mt-4 grid gap-4">
            <label className={labelClass}>Devise<select className={fieldClass} value={form.currency} onChange={(event) => update("currency", event.target.value)}>
              <option value="XOF">FCFA</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
            </select></label>
            <label className={labelClass}>Timezone<select className={fieldClass} value={form.timezone} onChange={(event) => update("timezone", event.target.value)}>
              <option value="Africa/Abidjan">Africa/Abidjan</option>
              <option value="UTC">UTC</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>Langue<select className={fieldClass} value={form.language} onChange={(event) => update("language", event.target.value)}>
                <option value="fr">Francais</option>
                <option value="en">Anglais</option>
              </select></label>
              <label className={labelClass}>Format date<select className={fieldClass} value={form.date_format} onChange={(event) => update("date_format", event.target.value)}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>Couleur principale<input className="h-12 w-full rounded-md border border-slate-300 bg-white p-1" type="color" value={form.primary_color} onChange={(event) => update("primary_color", event.target.value)} /></label>
              <label className={labelClass}>Couleur secondaire<input className="h-12 w-full rounded-md border border-slate-300 bg-white p-1" type="color" value={form.secondary_color} onChange={(event) => update("secondary_color", event.target.value)} /></label>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "finance" ? (
        <section className="mt-5 grid gap-4">
          <div className={cardClass}>
            <h2 className="flex items-center gap-2 text-lg font-black"><Landmark className="size-5 text-blue-700" /> Finances</h2>
            <div className="mt-4 grid gap-3">
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation depenses<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "expense_validation_enabled")} onChange={(event) => updateJson("finance_preferences", "expense_validation_enabled", event.target.checked)} /></label>
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation recettes<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "income_validation_enabled")} onChange={(event) => updateJson("finance_preferences", "income_validation_enabled", event.target.checked)} /></label>
            </div>
          </div>
          <div className={cardClass}>
            <h2 className="flex items-center gap-2 text-lg font-black"><CreditCard className="size-5 text-blue-700" /> Cotisations</h2>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>Periodicite<select className={fieldClass} value={String(form.contribution_preferences.periodicity || "MONTHLY")} onChange={(event) => updateJson("contribution_preferences", "periodicity", event.target.value)}>
                <option value="MONTHLY">Mensuelle</option>
                <option value="QUARTERLY">Trimestrielle</option>
                <option value="YEARLY">Annuelle</option>
              </select></label>
              <label className={labelClass}>Jour d'echeance<input className={fieldClass} min={1} max={31} type="number" value={Number(form.contribution_preferences.due_day || 30)} onChange={(event) => updateJson("contribution_preferences", "due_day", Number(event.target.value))} /></label>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "notifications" ? (
        <section className={`${cardClass} mt-5`}>
          <h2 className="flex items-center gap-2 text-lg font-black"><Bell className="size-5 text-blue-700" /> Notifications</h2>
          <div className="mt-4 grid gap-3">
            {[
              ["in_app", "Notification in-app"],
              ["email", "Email"],
              ["sms", "SMS"],
              ["whatsapp", "WhatsApp"]
            ].map(([key, label]) => (
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black" key={key}>
                {label}
                <input className="size-5 accent-blue-700" type="checkbox" checked={nestedBool(form.notification_preferences, "channels", key)} onChange={(event) => updateChannel(key, event.target.checked)} />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "security" ? (
        <section className="mt-5 grid gap-4">
          <div className={cardClass}>
            <h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="size-5 text-blue-700" /> Securite workspace</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
              <p>Les mots de passe restent geres au niveau du compte utilisateur.</p>
              <p>2FA disponible: {boolSetting(form.security_preferences, "two_factor_available") ? "Oui" : "Non"}</p>
              <p>Sessions workspace: {boolSetting(form.security_preferences, "session_review_available") ? "Disponible" : "Non configure"}</p>
            </div>
          </div>
          <div className={cardClass}>
            <h2 className="flex items-center gap-2 text-lg font-black"><SlidersHorizontal className="size-5 text-blue-700" /> Integrations et abonnement</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Plan: {form.subscription?.plan_name || "Freemium"}</div>
              {Object.entries(form.integration_states).map(([key, value]) => <div className="flex justify-between rounded-md border border-slate-200 p-3 text-sm font-bold" key={key}><span>{key}</span><span className="text-slate-500">{value}</span></div>)}
            </div>
          </div>
        </section>
      ) : null}

      <Button className="fixed bottom-24 left-4 right-4 z-20 min-h-12 bg-blue-700 text-white md:hidden" type="button" onClick={save} disabled={updateMutation.isPending}>
        <Save className="size-4" />
        {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </main>
  );
}
