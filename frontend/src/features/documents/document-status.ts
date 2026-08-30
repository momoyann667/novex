export const DOCUMENT_CATEGORIES = [
  { value: "administrative", label: "Administratif" },
  { value: "financial", label: "Financier" },
  { value: "members", label: "Membres" },
  { value: "contributions", label: "Cotisations" },
  { value: "project", label: "Projets" },
  { value: "event", label: "Evenements" },
  { value: "legal", label: "Juridique" },
  { value: "report", label: "Rapports" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Autres" },
] as const;

export const DOCUMENT_STATUSES = [
  { value: "active", label: "Actif" },
  { value: "pending", label: "A valider" },
  { value: "approved", label: "Approuve" },
  { value: "rejected", label: "Rejete" },
  { value: "archived", label: "Archive" },
  { value: "trash", label: "Corbeille" },
] as const;

export const DOCUMENT_VIEWS = ["Vue d'ensemble", "Tous", "Mes documents", "Partages", "Recents", "Favoris", "A valider", "Archives", "Corbeille"] as const;

export function statusTone(status: string) {
  if (status === "approved" || status === "Actif") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending" || status === "A valider") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "archived" || status === "Archive") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "trash" || status === "Corbeille") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}
