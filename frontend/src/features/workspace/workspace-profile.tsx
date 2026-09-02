"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";
import { createWorkspace, updateWorkspace } from "./api";

export type WorkspaceProfile = {
  country: string;
  associationName: string;
  associationType: string;
  logoDataUrl: string;
  currency: string;
  color: string;
};

const defaultProfile: WorkspaceProfile = {
  country: "Cote d'Ivoire",
  associationName: "",
  associationType: "Association culturelle",
  logoDataUrl: "",
  currency: "FCFA",
  color: "#0F7F2A"
};

function isValidWorkspaceSlug(workspaceSlug: string) {
  return workspaceSlug === "__new__" || !isInvalidWorkspaceSlug(workspaceSlug);
}

function storageKey(workspaceSlug: string) {
  return `novex.workspace.${workspaceSlug}.profile`;
}

function countryCode(country: string) {
  const countries: Record<string, string> = {
    "Cote d'Ivoire": "CI",
    Senegal: "SN",
    Mali: "ML",
    "Burkina Faso": "BF",
    Cameroun: "CM",
    France: "FR"
  };
  return countries[country] || country.slice(0, 2).toUpperCase();
}

function currencyCode(currency: string) {
  return currency === "FCFA" ? "XOF" : currency;
}

function organizationTypeCode(associationType: string) {
  const value = associationType.toLowerCase();
  if (value.includes("ong")) {
    return "ong";
  }
  if (value.includes("mutuelle")) {
    return "mutuelle";
  }
  if (value.includes("cooperative")) {
    return "cooperative";
  }
  return "association";
}

export function loadWorkspaceProfile(workspaceSlug: string): WorkspaceProfile | null {
  if (typeof window === "undefined" || !isValidWorkspaceSlug(workspaceSlug)) {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey(workspaceSlug));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WorkspaceProfile;
  } catch {
    return null;
  }
}

export function saveWorkspaceProfile(workspaceSlug: string, profile: WorkspaceProfile) {
  if (!isValidWorkspaceSlug(workspaceSlug)) {
    return;
  }

  window.localStorage.setItem(storageKey(workspaceSlug), JSON.stringify(profile));
}

function removeWorkspaceProfile(workspaceSlug: string) {
  if (!isValidWorkspaceSlug(workspaceSlug)) {
    return;
  }

  window.localStorage.removeItem(storageKey(workspaceSlug));
}

export function isWorkspaceSlugValid(workspaceSlug: string) {
  return isValidWorkspaceSlug(workspaceSlug);
}

export function WorkspaceProfileSetup({
  mode = "gate",
  workspaceSlug,
  onComplete
}: Readonly<{ mode?: "gate" | "settings" | "create"; workspaceSlug: string; onComplete?: (profile: WorkspaceProfile) => void }>) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<WorkspaceProfile>(defaultProfile);
  const [isReady, setIsReady] = useState(mode === "settings");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (mode === "create") {
      setIsReady(true);
      return;
    }
    const saved = loadWorkspaceProfile(workspaceSlug);
    if (saved) {
      setProfile(saved);
      if (mode === "gate") {
        onComplete?.(saved);
      }
    }
    setIsReady(true);
  }, [mode, onComplete, workspaceSlug]);

  const canContinue = useMemo(
    () => profile.country.trim().length > 1 && profile.associationName.trim().length > 1 && profile.associationType.trim().length > 1,
    [profile.associationName, profile.associationType, profile.country]
  );

  function update<K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => update("logoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submit() {
    setSubmitError(null);
    setIsSaving(true);
    try {
      const payload = {
        name: profile.associationName.trim(),
        organization_type: organizationTypeCode(profile.associationType),
        currency: currencyCode(profile.currency),
        country: countryCode(profile.country)
      };
      const workspace = mode === "create" ? await createWorkspace(payload) : await updateWorkspace(workspaceSlug, payload);
      saveWorkspaceProfile(workspace.slug, profile);
      if (mode !== "create" && workspace.slug !== workspaceSlug) {
        removeWorkspaceProfile(workspaceSlug);
      }
      onComplete?.(profile);
      if (mode === "create" || workspace.slug !== workspaceSlug) {
        router.replace(`/app/${workspace.slug}/dashboard`);
      }
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Impossible d'enregistrer les parametres.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady) {
    return <div className="min-h-screen bg-white" />;
  }

  if (mode === "gate" && loadWorkspaceProfile(workspaceSlug)) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-7 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[420px] flex-col">
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-normal text-emerald-700">{mode === "settings" ? "Parametres" : "Bienvenue sur NOVEX"}</div>
          <h1 className="mt-2 text-3xl font-black tracking-normal">{step === 1 ? "Votre association" : "Identite visuelle"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Etape {step} sur 2</p>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-2">
          <span className={`h-1.5 rounded-full ${step >= 1 ? "bg-emerald-600" : "bg-slate-200"}`} />
          <span className={`h-1.5 rounded-full ${step >= 2 ? "bg-emerald-600" : "bg-slate-200"}`} />
        </div>

        <div className="flex flex-1 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {step === 1 ? (
            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-bold">
                Pays
                <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium" value={profile.country} onChange={(event) => update("country", event.target.value)}>
                  <option>Cote d'Ivoire</option>
                  <option>Senegal</option>
                  <option>Mali</option>
                  <option>Burkina Faso</option>
                  <option>Cameroun</option>
                  <option>France</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Nom de l'association
                <input
                  className="min-h-12 rounded-md border border-slate-300 px-3 text-sm font-medium outline-none"
                  placeholder="Ex: Association des Entrepreneurs de Cocody"
                  value={profile.associationName}
                  onChange={(event) => update("associationName", event.target.value)}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Type d'association
                <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium" value={profile.associationType} onChange={(event) => update("associationType", event.target.value)}>
                  <option>Association culturelle</option>
                  <option>Association sportive</option>
                  <option>Association professionnelle</option>
                  <option>ONG</option>
                  <option>Mutuelle</option>
                  <option>Cooperative</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-bold">
                Logo de l'association
                <span className="flex min-h-24 items-center gap-4 rounded-md border border-dashed border-slate-300 px-4">
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100">
                    {profile.logoDataUrl ? <img alt="" className="size-full object-cover" src={profile.logoDataUrl} /> : <ImagePlus className="size-6 text-slate-500" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-500">Importer une image</span>
                  <input accept="image/*" className="hidden" type="file" onChange={handleLogo} />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Devise
                <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium" value={profile.currency} onChange={(event) => update("currency", event.target.value)}>
                  <option>FCFA</option>
                  <option>EUR</option>
                  <option>USD</option>
                  <option>CAD</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Couleur
                <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 px-3">
                  <Palette className="size-5 text-slate-500" />
                  <input className="size-8 rounded border-0 bg-transparent p-0" type="color" value={profile.color} onChange={(event) => update("color", event.target.value)} />
                  <span className="text-sm font-medium text-slate-500">{profile.color}</span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-auto grid gap-3 pt-8">
            {submitError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{submitError}</p> : null}
            {step === 1 ? (
              <Button className="min-h-12 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!canContinue} type="button" onClick={() => setStep(2)}>
                Continuer
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button className="min-h-12 bg-emerald-600 text-white hover:bg-emerald-700" disabled={isSaving} type="button" onClick={submit}>
                {isSaving ? "Enregistrement..." : mode === "settings" ? "Enregistrer" : "OK, ouvrir NOVEX"}
                <Check className="size-4" />
              </Button>
            )}
            {step === 2 ? (
              <Button className="min-h-11" type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Retour
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
