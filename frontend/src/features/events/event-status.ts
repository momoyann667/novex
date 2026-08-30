export const EVENT_TYPES = [
  { value: "MEETING", label: "Reunion" },
  { value: "GENERAL_ASSEMBLY", label: "Assemblee generale" },
  { value: "TRAINING", label: "Formation" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "SEMINAR", label: "Seminaire" },
  { value: "WORKSHOP", label: "Atelier" },
  { value: "CEREMONY", label: "Ceremonie" },
  { value: "FUNDRAISING", label: "Collecte de fonds" },
  { value: "SOCIAL", label: "Social" },
  { value: "COMMUNITY", label: "Communautaire" },
  { value: "SPORT", label: "Sport" },
  { value: "CULTURAL", label: "Culturel" },
  { value: "OTHER", label: "Autre" },
] as const;

export const EVENT_STATUSES = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "PLANNED", label: "Planifie" },
  { value: "REGISTRATION_OPEN", label: "Inscriptions ouvertes" },
  { value: "REGISTRATION_CLOSED", label: "Inscriptions fermees" },
  { value: "ONGOING", label: "En cours" },
  { value: "COMPLETED", label: "Termine" },
  { value: "CANCELLED", label: "Annule" },
  { value: "POSTPONED", label: "Reporte" },
  { value: "ARCHIVED", label: "Archive" },
] as const;

export const CALENDAR_MODES = ["Mois", "Semaine", "Jour", "Agenda"] as const;
