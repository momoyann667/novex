"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, CreditCard, LogOut, Pencil, Plus, Save, ShieldCheck, Star, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentMemberProfile } from "@/features/members/current-member-profile";
import { getWorkspaceSettings, updateWorkspaceSettings, type WorkspaceSettingsResource, type WorkspaceSettingsUpdatePayload } from "./api";

export type SettingsSection = "association" | "members" | "finance" | "users" | "security" | "subscription";

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
  money_format: { thousand_separator: " ", decimal_separator: ",", decimals: 0, symbol: "FCFA", symbol_position: "after" },
  theme: "light",
  primary_color: "#0F7FF2",
  secondary_color: "#3B82F6",
  finance_preferences: {
    expense_validation_enabled: true,
    income_validation_enabled: false,
    expense_validation_threshold: 50000,
    expense_categories: ["Transport", "Communication", "Materiel", "Evenements", "Logistique"],
    revenue_categories: ["Cotisations", "Dons", "Subventions", "Partenariats", "Autres recettes"],
    payment_methods: ["Especes", "Virement bancaire", "Orange Money", "MTN MoMo", "Moov Money", "Wave"],
    accounts: ["Compte bancaire principal", "Caisse association", "Wave Association"],
    numbering_prefixes: { expenses: "DEP", revenues: "REC", transactions: "TRX" }
  },
  contribution_preferences: { periodicity: "MONTHLY", due_day: 30, reminders: ["before_due", "due_day", "after_due"] },
  notification_preferences: { channels: { in_app: true, email: true, sms: false, whatsapp: false } },
  member_preferences: {
    manual_approval: true,
    categories: ["Membre actif", "Membre honoraire", "Membre fondateur", "Membre bienfaiteur"],
    statuses: ["Actif", "Inactif", "Suspendu", "En attente", "Archive"],
    groups: ["Bureau executif", "Commission finance", "Commission communication"],
    functions: ["President", "Tresorier", "Secretaire", "Responsable communication"],
    custom_fields: ["Profession", "Date de naissance", "Quartier", "Personne a contacter"]
  },
  project_preferences: { budget_alert_threshold: 80, budget_block_threshold: 100, budget_overrun_allowed: false },
  event_preferences: {},
  document_preferences: {},
  integration_states: {},
  security_preferences: { two_factor_available: false, session_review_available: false }
};

const settingsRows: Array<{ id: SettingsSection; title: string; subtitle: string; icon: typeof Building2 }> = [
  { id: "association", title: "Association", subtitle: "Nom, logo, devise", icon: Building2 },
  { id: "members", title: "Membres", subtitle: "Categories, statuts", icon: Users },
  { id: "finance", title: "Finance", subtitle: "Comptes, paiements", icon: CreditCard },
  { id: "users", title: "Utilisateurs", subtitle: "Roles, permissions", icon: Users },
  { id: "security", title: "Securite", subtitle: "Mot de passe, 2FA", icon: ShieldCheck },
  { id: "subscription", title: "Abonnement", subtitle: "Plan, facturation", icon: Star }
];

function boolSetting(source: Record<string, unknown>, key: string) {
  return Boolean(source[key]);
}

function nestedBool(source: Record<string, unknown>, group: string, key: string) {
  const nested = source[group];
  if (!nested || typeof nested !== "object") return false;
  return Boolean((nested as Record<string, unknown>)[key]);
}

function stringList(source: Record<string, unknown>, key: string, fallback: string[] = []) {
  const value = source[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function numericSetting(source: Record<string, unknown>, key: string, fallback: number) {
  const value = source[key];
  return typeof value === "number" ? value : fallback;
}

function textSetting(source: Record<string, unknown>, key: string, fallback: string) {
  const value = source[key];
  return typeof value === "string" ? value : fallback;
}

export function WorkspaceSettingsView({ workspaceSlug, section }: Readonly<{ workspaceSlug: string; section?: SettingsSection }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(section || null);
  const [form, setForm] = useState<WorkspaceSettingsResource>(defaultSettings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug)
  });

  useEffect(() => {
    setActiveSection(section || null);
  }, [section]);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        ...defaultSettings,
        ...settingsQuery.data,
        profile: { ...defaultSettings.profile, ...settingsQuery.data.profile },
        finance_preferences: { ...defaultSettings.finance_preferences, ...settingsQuery.data.finance_preferences },
        member_preferences: { ...defaultSettings.member_preferences, ...settingsQuery.data.member_preferences },
        project_preferences: { ...defaultSettings.project_preferences, ...settingsQuery.data.project_preferences },
        money_format: { ...defaultSettings.money_format, ...settingsQuery.data.money_format },
        security_preferences: { ...defaultSettings.security_preferences, ...settingsQuery.data.security_preferences }
      });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: WorkspaceSettingsUpdatePayload) => updateWorkspaceSettings(workspaceSlug, payload),
    onSuccess: async (settings) => {
      setForm({ ...defaultSettings, ...settings, profile: { ...defaultSettings.profile, ...settings.profile } });
      setNotice(`Parametres de ${settings.workspace_name} enregistres.`);
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceSlug] });
      if (settings.workspace_slug && settings.workspace_slug !== workspaceSlug) {
        router.replace(`/app/${settings.workspace_slug}/settings${activeSection ? `/${activeSection}` : ""}`);
      }
    }
  });

  function update<K extends keyof WorkspaceSettingsResource>(key: K, value: WorkspaceSettingsResource[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProfile<K extends keyof WorkspaceSettingsResource["profile"]>(key: K, value: WorkspaceSettingsResource["profile"][K]) {
    setForm((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }

  function updateRecord(sectionName: "finance_preferences" | "member_preferences" | "project_preferences" | "money_format" | "notification_preferences", key: string, value: unknown) {
    setForm((current) => ({ ...current, [sectionName]: { ...current[sectionName], [key]: value } }));
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

  function addListItem(sectionName: "member_preferences" | "finance_preferences", key: string, value: string) {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    setForm((current) => {
      const source = current[sectionName];
      return { ...current, [sectionName]: { ...source, [key]: [...stringList(source, key), cleanValue] } };
    });
  }

  function removeListItem(sectionName: "member_preferences" | "finance_preferences", key: string, index: number) {
    setForm((current) => {
      const source = current[sectionName];
      return { ...current, [sectionName]: { ...source, [key]: stringList(source, key).filter((_, itemIndex) => itemIndex !== index) } };
    });
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
      security_preferences: form.security_preferences,
      logo: logoFile || undefined
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
        <button className="flex size-9 items-center justify-center rounded-full text-slate-700" type="button" onClick={() => (activeSection ? router.push(`/app/${workspaceSlug}/settings`) : router.back())} aria-label="Retour">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-center text-sm font-black">{activeSection ? sectionTitle(activeSection) : "Parametres"}</h1>
        <span />
      </header>

      {notice ? <Alert tone="success" message={notice} /> : null}
      {settingsQuery.isError || updateMutation.isError ? <Alert tone="error" message="Impossible de charger ou enregistrer les parametres." /> : null}

      {activeSection ? (
        <nav className="mt-4 grid grid-cols-2 gap-3" aria-label="Sous-menus parametres">
          {settingsRows.map((row) => (
            <Link className={`flex min-h-20 items-center rounded-lg px-4 text-base font-black shadow-sm ${activeSection === row.id ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-900"}`} href={`/app/${workspaceSlug}/settings/${row.id}`} key={`shortcut-${row.id}`}>
              <span className="truncate">{row.title}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {!activeSection ? (
        <>
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-14 overflow-hidden rounded-full bg-slate-200">
                {currentMemberProfile.photoUrl ? <img className="size-full object-cover" src={currentMemberProfile.photoUrl} alt={currentMemberProfile.fullName} /> : <div className="grid size-full place-items-center bg-[#0f2347] text-sm font-black text-white">{currentMemberProfile.initials}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black">{currentMemberProfile.fullName}</h2>
                <p className="truncate text-xs font-semibold text-slate-500">{currentMemberProfile.email}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />En ligne</span>
              </div>
              <Link className="flex size-9 items-center justify-center rounded-full text-slate-700" href={`/app/${workspaceSlug}/settings/association`} aria-label="Modifier le profil">
                <Pencil className="size-4" />
              </Link>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {settingsRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <Link className={`flex w-full items-center gap-4 px-4 py-5 text-left ${index ? "border-t border-slate-100" : ""}`} key={row.id} href={`/app/${workspaceSlug}/settings/${row.id}`}>
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-950"><Icon className="size-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xl font-black tracking-normal">{row.title}</span><span className="mt-1 block truncate text-sm font-semibold text-slate-500">{row.subtitle}</span></span>
                  <ChevronRight className="size-5 shrink-0 text-slate-500" />
                </Link>
              );
            })}
          </section>

          <p className="mt-8 text-center text-[10px] font-bold text-slate-400">NOVEX v2.4.1</p>
        </>
      ) : (
        <section className="mt-5 grid gap-4">
          {activeSection === "association" ? (
            <SettingsCard title="Association">
              <label className={labelClass}>Nom<input className={fieldClass} value={form.workspace_name} onChange={(event) => update("workspace_name", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Sigle<input className={fieldClass} value={form.acronym} onChange={(event) => update("acronym", event.target.value)} /></label>
                <label className={labelClass}>Devise<select className={fieldClass} value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                  <option value="XOF">FCFA</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="CAD">CAD</option>
                </select></label>
              </div>
              <label className={labelClass}>Type<select className={fieldClass} value={form.organization_type} onChange={(event) => update("organization_type", event.target.value)}>
                <option value="association">Association</option><option value="ong">ONG</option><option value="syndicat">Syndicat</option><option value="cooperative">Cooperative</option><option value="club">Club</option><option value="community">Organisation communautaire</option>
              </select></label>
              <label className={labelClass}>Secteur / domaine<input className={fieldClass} value={form.primary_contact_function} onChange={(event) => update("primary_contact_function", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Date de creation<input className={fieldClass} type="date" value={form.founded_on || ""} onChange={(event) => update("founded_on", event.target.value || null)} /></label>
                <label className={labelClass}>N° enregistrement<input className={fieldClass} value={form.registration_number} onChange={(event) => update("registration_number", event.target.value)} /></label>
              </div>
              <label className={labelClass}>Description<textarea className={`${fieldClass} min-h-24 py-3`} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
              <label className={labelClass}>Logo<input className={fieldClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Couleur principale<input className="h-12 rounded-md border border-slate-300 bg-white p-1" type="color" value={form.primary_color} onChange={(event) => update("primary_color", event.target.value)} /></label>
                <label className={labelClass}>Couleur secondaire<input className="h-12 rounded-md border border-slate-300 bg-white p-1" type="color" value={form.secondary_color} onChange={(event) => update("secondary_color", event.target.value)} /></label>
              </div>
              <label className={labelClass}>Telephone<input className={fieldClass} value={form.profile.contact_phone} onChange={(event) => updateProfile("contact_phone", event.target.value)} /></label>
              <label className={labelClass}>Email<input className={fieldClass} type="email" value={form.profile.contact_email} onChange={(event) => updateProfile("contact_email", event.target.value)} /></label>
              <label className={labelClass}>Site web<input className={fieldClass} value={form.profile.website_url} onChange={(event) => updateProfile("website_url", event.target.value)} /></label>
              <label className={labelClass}>Adresse<textarea className={`${fieldClass} min-h-20 py-3`} value={form.profile.address} onChange={(event) => updateProfile("address", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Ville<input className={fieldClass} value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
                <label className={labelClass}>Region<input className={fieldClass} value={form.region} onChange={(event) => update("region", event.target.value)} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Pays<input className={fieldClass} maxLength={2} value={form.country} onChange={(event) => update("country", event.target.value.toUpperCase())} /></label>
                <label className={labelClass}>Timezone<select className={fieldClass} value={form.timezone} onChange={(event) => update("timezone", event.target.value)}><option value="Africa/Abidjan">Africa/Abidjan</option><option value="UTC">UTC</option><option value="Europe/Paris">Europe/Paris</option></select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Langue<select className={fieldClass} value={form.language} onChange={(event) => update("language", event.target.value)}><option value="fr">Francais</option><option value="en">English</option></select></label>
                <label className={labelClass}>Format date<select className={fieldClass} value={form.date_format} onChange={(event) => update("date_format", event.target.value)}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Symbole<input className={fieldClass} value={textSetting(form.money_format, "symbol", "FCFA")} onChange={(event) => updateRecord("money_format", "symbol", event.target.value)} /></label>
                <label className={labelClass}>Decimales<input className={fieldClass} type="number" value={numericSetting(form.money_format, "decimals", 0)} onChange={(event) => updateRecord("money_format", "decimals", Number(event.target.value))} /></label>
              </div>
            </SettingsCard>
          ) : null}

          {activeSection === "members" ? (
            <SettingsCard title="Membres">
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation manuelle<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.member_preferences, "manual_approval")} onChange={(event) => updateRecord("member_preferences", "manual_approval", event.target.checked)} /></label>
              <EditableList title="Categories" values={stringList(form.member_preferences, "categories", stringList(defaultSettings.member_preferences, "categories"))} onAdd={(value) => addListItem("member_preferences", "categories", value)} onRemove={(index) => removeListItem("member_preferences", "categories", index)} />
              <EditableList title="Statuts" values={stringList(form.member_preferences, "statuses", stringList(defaultSettings.member_preferences, "statuses"))} onAdd={(value) => addListItem("member_preferences", "statuses", value)} onRemove={(index) => removeListItem("member_preferences", "statuses", index)} />
              <EditableList title="Groupes" values={stringList(form.member_preferences, "groups", stringList(defaultSettings.member_preferences, "groups"))} onAdd={(value) => addListItem("member_preferences", "groups", value)} onRemove={(index) => removeListItem("member_preferences", "groups", index)} />
              <EditableList title="Fonctions associatives" values={stringList(form.member_preferences, "functions", stringList(defaultSettings.member_preferences, "functions"))} onAdd={(value) => addListItem("member_preferences", "functions", value)} onRemove={(index) => removeListItem("member_preferences", "functions", index)} />
              <EditableList title="Champs personnalises" values={stringList(form.member_preferences, "custom_fields", stringList(defaultSettings.member_preferences, "custom_fields"))} onAdd={(value) => addListItem("member_preferences", "custom_fields", value)} onRemove={(index) => removeListItem("member_preferences", "custom_fields", index)} />
            </SettingsCard>
          ) : null}

          {activeSection === "finance" ? (
            <SettingsCard title="Finance">
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation depenses<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "expense_validation_enabled")} onChange={(event) => updateRecord("finance_preferences", "expense_validation_enabled", event.target.checked)} /></label>
              <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black">Validation recettes<input className="size-5 accent-blue-700" type="checkbox" checked={boolSetting(form.finance_preferences, "income_validation_enabled")} onChange={(event) => updateRecord("finance_preferences", "income_validation_enabled", event.target.checked)} /></label>
              <label className={labelClass}>Seuil validation depense<input className={fieldClass} type="number" value={numericSetting(form.finance_preferences, "expense_validation_threshold", 50000)} onChange={(event) => updateRecord("finance_preferences", "expense_validation_threshold", Number(event.target.value))} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Alerte budget (%)<input className={fieldClass} type="number" value={numericSetting(form.project_preferences, "budget_alert_threshold", 80)} onChange={(event) => updateRecord("project_preferences", "budget_alert_threshold", Number(event.target.value))} /></label>
                <label className={labelClass}>Blocage budget (%)<input className={fieldClass} type="number" value={numericSetting(form.project_preferences, "budget_block_threshold", 100)} onChange={(event) => updateRecord("project_preferences", "budget_block_threshold", Number(event.target.value))} /></label>
              </div>
              <EditableList title="Categories de depenses" values={stringList(form.finance_preferences, "expense_categories", stringList(defaultSettings.finance_preferences, "expense_categories"))} onAdd={(value) => addListItem("finance_preferences", "expense_categories", value)} onRemove={(index) => removeListItem("finance_preferences", "expense_categories", index)} />
              <EditableList title="Categories de recettes" values={stringList(form.finance_preferences, "revenue_categories", stringList(defaultSettings.finance_preferences, "revenue_categories"))} onAdd={(value) => addListItem("finance_preferences", "revenue_categories", value)} onRemove={(index) => removeListItem("finance_preferences", "revenue_categories", index)} />
              <EditableList title="Modes de paiement" values={stringList(form.finance_preferences, "payment_methods", stringList(defaultSettings.finance_preferences, "payment_methods"))} onAdd={(value) => addListItem("finance_preferences", "payment_methods", value)} onRemove={(index) => removeListItem("finance_preferences", "payment_methods", index)} />
              <EditableList title="Comptes financiers" values={stringList(form.finance_preferences, "accounts", stringList(defaultSettings.finance_preferences, "accounts"))} onAdd={(value) => addListItem("finance_preferences", "accounts", value)} onRemove={(index) => removeListItem("finance_preferences", "accounts", index)} />
            </SettingsCard>
          ) : null}

          {activeSection === "users" ? (
            <SettingsCard title="Utilisateurs">
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold text-slate-600">Utilisateur courant : {currentMemberProfile.fullName} - Role NOVEX : Administrateur - Fonction associative : {currentMemberProfile.function}</div>
              <label className={labelClass}>Inviter un utilisateur<input className={fieldClass} type="email" placeholder="email@association.org" /></label>
              <label className={labelClass}>Role<select className={fieldClass} defaultValue="Administrateur"><option>Administrateur</option><option>Tresorier</option><option>Secretaire</option><option>Responsable projet</option><option>Responsable communication</option><option>Membre</option></select></label>
              {[["in_app", "Notification in-app"], ["email", "Email"], ["sms", "SMS"], ["whatsapp", "WhatsApp"]].map(([key, label]) => (
                <label className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-black" key={key}>{label}<input className="size-5 accent-blue-700" type="checkbox" checked={nestedBool(form.notification_preferences, "channels", key)} onChange={(event) => updateChannel(key, event.target.checked)} /></label>
              ))}
            </SettingsCard>
          ) : null}

          {activeSection === "security" ? (
            <SettingsCard title="Securite">
              <label className={labelClass}>Mot de passe actuel<input className={fieldClass} type="password" placeholder="********" /></label>
              <label className={labelClass}>Nouveau mot de passe<input className={fieldClass} type="password" placeholder="********" /></label>
              <label className={labelClass}>Confirmation<input className={fieldClass} type="password" placeholder="********" /></label>
              <p className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-600">Mot de passe, 2FA et sessions restent controles par le backend d'authentification.</p>
              <p className="text-sm font-semibold text-slate-600">2FA: {boolSetting(form.security_preferences, "two_factor_available") ? "Disponible" : "Non configure"}</p>
              <p className="text-sm font-semibold text-slate-600">Sessions: {boolSetting(form.security_preferences, "session_review_available") ? "Disponible" : "Non configure"}</p>
              <button className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700" type="button" onClick={signOut}>Deconnecter cette session</button>
            </SettingsCard>
          ) : null}

          {activeSection === "subscription" ? (
            <SettingsCard title="Abonnement">
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Plan: {form.subscription?.plan_name || "Freemium"}</div>
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Statut: {form.subscription?.status || "active"}</div>
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Fin d'essai: {form.subscription?.trial_ends_at || "Non renseignee"}</div>
              <div className="rounded-md bg-slate-50 p-3 text-sm font-bold">Entitlements: {Object.keys(form.subscription?.entitlements || {}).length}</div>
              <button className="min-h-11 rounded-md bg-blue-700 px-3 text-sm font-black text-white" type="button">Comparer les plans</button>
            </SettingsCard>
          ) : null}

          <Button className="min-h-12 w-full bg-blue-700 text-white" type="button" onClick={save} disabled={updateMutation.isPending}>
            <Save className="size-4" />
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </section>
      )}

      <button className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-red-100 text-sm font-black text-red-700" type="button" onClick={signOut} disabled={isSigningOut}>
        <LogOut className="size-4" />
        {isSigningOut ? "Deconnexion..." : "Se deconnecter"}
      </button>
    </main>
  );
}

function Alert({ tone, message }: Readonly<{ tone: "success" | "error"; message: string }>) {
  const className = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700";
  return <div className={`mt-4 flex items-center gap-2 rounded-md border px-4 py-3 text-xs font-bold ${className}`}><CheckCircle2 className="size-4" />{message}</div>;
}

function SettingsCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <div className={cardClass}><h2 className="text-lg font-black">{title}</h2><div className="mt-4 grid gap-4">{children}</div></div>;
}

function EditableList({ title, values, onAdd, onRemove }: Readonly<{ title: string; values: string[]; onAdd: (value: string) => void; onRemove: (index: number) => void }>) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-3 grid gap-2">
        {values.length ? values.map((value, index) => (
          <div className="flex min-h-10 items-center justify-between gap-3 rounded-md bg-white px-3 text-sm font-bold text-slate-700" key={`${title}-${value}-${index}`}>
            <span className="min-w-0 truncate">{value}</span>
            <button className="grid size-8 shrink-0 place-items-center rounded-md text-red-600" type="button" onClick={() => onRemove(index)} aria-label={`Supprimer ${value}`}><Trash2 className="size-4" /></button>
          </div>
        )) : <p className="text-xs font-bold text-slate-500">Aucun element configure.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ajouter" />
        <button className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-700 text-white" type="button" onClick={() => { onAdd(draft); setDraft(""); }} aria-label={`Ajouter ${title}`}><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

function sectionTitle(section: SettingsSection) {
  return settingsRows.find((row) => row.id === section)?.title || "Parametres";
}
