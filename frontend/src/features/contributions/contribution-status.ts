export const CONTRIBUTION_TYPES = [
  { value: "MEMBERSHIP", label: "Adhesion" },
  { value: "MONTHLY", label: "Mensuelle" },
  { value: "QUARTERLY", label: "Trimestrielle" },
  { value: "YEARLY", label: "Annuelle" },
  { value: "SPECIAL", label: "Speciale" },
  { value: "EVENT", label: "Evenementielle" },
  { value: "PROJECT", label: "Projet" },
  { value: "OTHER", label: "Autre" },
] as const;

export const CONTRIBUTION_PERIODICITIES = [
  { value: "ONE_TIME", label: "Ponctuelle" },
  { value: "MONTHLY", label: "Mensuelle" },
  { value: "QUARTERLY", label: "Trimestrielle" },
  { value: "YEARLY", label: "Annuelle" },
  { value: "CUSTOM", label: "Personnalisee" },
] as const;

export const CONTRIBUTION_STATUSES = [
  { value: "PENDING", label: "Non payee" },
  { value: "PARTIALLY_PAID", label: "Partielle" },
  { value: "PAID", label: "A jour" },
  { value: "OVERDUE", label: "En retard" },
  { value: "CANCELLED", label: "Annulee" },
  { value: "WAIVED", label: "Exoneree" },
] as const;

export const CONTRIBUTION_CAMPAIGN_STATUSES = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "En pause" },
  { value: "CLOSED", label: "Cloturee" },
  { value: "CANCELLED", label: "Annulee" },
] as const;

export const CAMPAIGN_TARGET_MODES = [
  { value: "ALL_ACTIVE", label: "Tous les membres actifs" },
  { value: "CATEGORY", label: "Categorie" },
  { value: "SELECTED", label: "Selection" },
  { value: "SEGMENT", label: "Segment" },
] as const;
