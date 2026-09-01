"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  LogOut,
  Pencil,
  Save,
  ShieldCheck,
  Star,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspaceSettings, updateWorkspaceSettings, type WorkspaceSettingsResource, type WorkspaceSettingsUpdatePayload } from "./api";

type SettingsSection = "association" | "members" | "finance" | "users" | "security" | "subscription";

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

const settingsRows: Array<{ id: SettingsSection; title: string; subtitle: string; icon: typeof Building2 }> = [
  { id: "association", title: "Association", subtitle: "Name, logo, currency", icon: Building2 },
  { id: "members", title: "Members", subtitle: "Categories, status rules", icon: Users },
  { id: "finance", title: "Finance", subtitle: "Accounts, payment methods", icon: CreditCard },
  { id: "users", title: "Users", subtitle: "Roles, permissions", icon: Users },
  { id: "security", title: "Security", subtitle: "Password, 2FA", icon: ShieldCheck },
  { id: "subscription", title: "Subscription", subtitle: "Plan, billing", icon: Star }
];

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
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [form, setForm] = useState<WorkspaceSettingsResource>(defaultSettings);
  const [notice, setNotice] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  function updateJson(section: "finance_preferences" | "contribution_preferences" | "notification_preferences" | "member_preferences", key: string, value: unknown) {
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

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 pb-6 pt-4 text-slate-950 md:rounded-[28px]">
      <header className="grid grid-cols-[36px_1fr_36px] items-center">
        <button className="flex size-9 items-center justify-center rounded-full text-slate-700" type="button" onClick={() => (activeSection ? setActiveSection(null) : router.back())} aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-center text-sm font-black">{activeSection ? sectionTitle(activeSection) : "Settings"}</h1>
        <span />
      </header>

      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {notice}
        </div>
      ) : null}
      {settingsQuery.isError || updateMutation.isError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">Impossible de charger ou enregistrer les parametres.</p>
      ) : null}

      {!activeSection ? (
        <>
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-14 overflow-hidden rounded-full bg-slate-200">
                <img className="size-full object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80" alt="Admin" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black">Admin User</h2>
                <p className="truncate text-xs font-semibold text-slate-500">{form.primary_contact_email || form.profile.contact_email || "admin@novex.com"}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  En ligne
                </span>
              </div>
              <button className="flex size-9 items-center justify-center rounded-full text-slate-700" type="button" onClick={() => setActiveSection("association")} aria-label="Modifier le profil">
                <Pencil className="size-4" />
              </button>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {settingsRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <button className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? "border-t border-slate-100" : ""}`} key={row.id} type="button" onClick={() => setActiveSection(row.id)}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-950">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{row.title}</span>
                    <span className="block truncate text-xs font-semibold text-slate-500">{row.subtitle}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-500" />
                </button>
              );
            })}
          </section>

          <button className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-red-100 text-sm font-black text-red-700" type="button" onClick={signOut} disabled={isSigningOut}>
            <LogOut className="size-4" />
            {isSigningOut ? "Deconnexion..." : "Sign Out"}
          </button>

          <p className="mt-8 text-center text-[10px] font-bold text-slate-400">NOVEX v2.4.1</p>
        </>
      ) : (
        <section className="mt-5 grid gap-4">
          {activeSection === "association" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Association</h2>
              <div className="mt-4 grid gap-4">
                <label className={labelClass}>Nom<input className={fieldClass} value={form.workspace_name} onChange={(event) => update("workspace_name", event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>Sigle<input className={fieldClass} value={form.acronym} onChange={(event) => update("acronym", event.target.value)} /></label>
                  <label className={labelClass}>Devise<select className={fieldClass} value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                    <option value="XOF">FCFA</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                  </select></label>
                </div>
                <label className={labelClass}>Type<select className={fieldClass} value={form.organization_type} onChange={(event) => update("organization_type", event.target.value)}>
                  <option value="association">Association</option>
                  <option value="ong">ONG</option>
                  <option value="syndicat">Syndicat</option>
                  <option value="cooperative">Cooperative</option>
                  <option value="club">Club</option>
                  <option value="community">Organisation communautaire</option>
                </select></label>
                <label className={labelClass}>Description<textarea className={`${fieldClass} min-h-24 py-3`} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
                <label className={labelClass}>Adresse<textarea className={`${fieldClass} min-h-20 py-3`} value={form.profile.address} onChange={(event) => updateProfile("address", event.target.value)} /></label>
              </div>
            </div>
          ) : null}

          {activeSection === "members" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Members</h2>
              <div className="mt-4 grid gap-3">
                <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation manuelle<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.member_preferences, "manual_approval")} onChange={(event) => updateJson("member_preferences", "manual_approval", event.target.checked)} /></label>
                <p className="rounded-md bg-slate-50 p-3 text-xs font-bold text-slate-500">Les categories et statuts seront relies au module Gestion des membres.</p>
              </div>
            </div>
          ) : null}

          {activeSection === "finance" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Finance</h2>
              <div className="mt-4 grid gap-3">
                <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation depenses<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "expense_validation_enabled")} onChange={(event) => updateJson("finance_preferences", "expense_validation_enabled", event.target.checked)} /></label>
                <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation recettes<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "income_validation_enabled")} onChange={(event) => updateJson("finance_preferences", "income_validation_enabled", event.target.checked)} /></label>
              </div>
            </div>
          ) : null}

          {activeSection === "users" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Users</h2>
              <div className="mt-4 grid gap-3">
                {[["in_app", "Notification in-app"], ["email", "Email"], ["sms", "SMS"], ["whatsapp", "WhatsApp"]].map(([key, label]) => (
                  <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black" key={key}>
                    {label}
                    <input className="size-5 accent-blue-700" type="checkbox" checked={nestedBool(form.notification_preferences, "channels", key)} onChange={(event) => updateChannel(key, event.target.checked)} />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === "security" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Security</h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
                <p>Password gere au niveau du compte utilisateur.</p>
                <p>2FA: {boolSetting(form.security_preferences, "two_factor_available") ? "Disponible" : "Non configure"}</p>
                <p>Sessions: {boolSetting(form.security_preferences, "session_review_available") ? "Disponible" : "Non configure"}</p>
              </div>
            </div>
          ) : null}

          {activeSection === "subscription" ? (
            <div className={cardClass}>
              <h2 className="text-lg font-black">Subscription</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Plan: {form.subscription?.plan_name || "Freemium"}</div>
                <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Statut: {form.subscription?.status || "active"}</div>
              </div>
            </div>
          ) : null}

          <Button className="min-h-12 w-full bg-blue-700 text-white" type="button" onClick={save} disabled={updateMutation.isPending}>
            <Save className="size-4" />
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </section>
      )}
    </main>
  );
}

function sectionTitle(section: SettingsSection) {
  return settingsRows.find((row) => row.id === section)?.title || "Settings";
}
