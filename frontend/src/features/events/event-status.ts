export const EVENT_TYPES = [
  { value: "MEETING", label: "Reunion" },
  { value: "GENERAL_ASSEMBLY", label: "Assemblee generale" },
  { value: "TRAINING", label: "Formation" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "CEREMONY", label: "Ceremonie" },
  { value: "FUNDRAISING", label: "Collecte de fonds" },
  { value: "COMMUNITY", label: "Communautaire" },
  { value: "SPORT", label: "Sport" },
  { value: "CULTURAL", label: "Culturel" },
  { value: "OTHER", label: "Autre" },
] as const;

export const EVENT_STATUSES = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "PLANNED", label: "Planifie" },
  { value: "ONGOING", label: "En cours" },
  { value: "COMPLETED", label: "Termine" },
  { value: "CANCELLED", label: "Annule" },
  { value: "POSTPONED", label: "Reporte" },
] as const;

export const CALENDAR_MODES = ["Mois", "Semaine", "Jour", "Agenda"] as const;
