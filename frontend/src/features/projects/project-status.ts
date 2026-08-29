export const PROJECT_STATUSES = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "PLANNED", label: "Planifie" },
  { value: "ACTIVE", label: "Actif" },
  { value: "ON_HOLD", label: "En pause" },
  { value: "COMPLETED", label: "Termine" },
  { value: "CANCELLED", label: "Annule" },
] as const;

export const PROJECT_PRIORITIES = [
  { value: "LOW", label: "Basse" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Haute" },
  { value: "CRITICAL", label: "Critique" },
] as const;
