import { apiFetch } from "@/lib/api/client";

export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PLANNED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED"
  | "ARCHIVED";

export type EventType =
  | "MEETING"
  | "GENERAL_ASSEMBLY"
  | "TRAINING"
  | "CONFERENCE"
  | "SEMINAR"
  | "WORKSHOP"
  | "CEREMONY"
  | "FUNDRAISING"
  | "SOCIAL"
  | "COMMUNITY"
  | "SPORT"
  | "CULTURAL"
  | "OTHER";

export type EventLocationType = "PHYSICAL" | "ONLINE" | "HYBRID";

export type EventStats = {
  participants: number;
  registered: number;
  confirmed: number;
  waitlisted: number;
  attended: number;
  absent: number;
  attendance_rate: number;
  occupancy_rate: number;
  capacity: number;
  budget: string | number;
  expenses: string | number;
  revenues: string | number;
  remaining: string | number;
  balance: string | number;
  budget_consumed_rate: number;
};

export type EventResource = {
  id: number;
  code: string;
  title: string;
  description: string;
  cover_image: string;
  event_type: EventType;
  event_type_label: string;
  status: EventStatus;
  status_label: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: EventLocationType;
  location: string;
  address: string;
  city: string;
  country: string;
  registration_required: boolean;
  registration_deadline: string | null;
  capacity: number | null;
  budget: string;
  ticket_price: string;
  project: number | null;
  recurrence: string;
  stats: EventStats;
  created_at: string;
  updated_at: string;
};

export type EventOverview = {
  upcoming_events: number;
  month_events: number;
  completed_events: number;
  cancelled_events: number;
  planned_participants: number;
  average_attendance_rate: number;
  total_budget: string | number;
  total_expenses: string | number;
  total_revenues: string | number;
  net_result: string | number;
};

export type CalendarItem = {
  id: string;
  source_type: "EVENT" | "MEETING" | "DEADLINE" | "CONTRIBUTION" | "PROJECT" | "TASK" | "REMINDER" | "COMMUNICATION" | "FINANCE" | "OTHER";
  title: string;
  description: string;
  status: string;
  start_at: string;
  end_at: string;
  location: string;
  all_day: boolean;
  color: string;
  source_url: string;
};

export type EventFormPayload = {
  title: string;
  description?: string;
  event_type: EventType;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: EventLocationType;
  location?: string;
  status: EventStatus;
  capacity?: number | null;
  budget: number;
  recurrence: string;
  registration_required?: boolean;
  registration_deadline?: string | null;
  cover_image?: File | null;
  online_url?: string;
  ticket_price?: number;
  project?: number | null;
  responsible_member?: number | null;
};

export type ProjectOption = {
  id: number;
  code: string;
  name: string;
};

export type MemberOption = {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  function: string;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function workspaceHeaders(workspaceSlug: string) {
  return { "X-Workspace": workspaceSlug };
}

function unwrapList<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function listEvents(workspaceSlug: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const payload = await apiFetch<EventResource[] | Paginated<EventResource>>(`/events/${suffix}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function listCalendarItems(workspaceSlug: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<CalendarItem[]>(`/events/calendar/${suffix}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getEvent(workspaceSlug: string, eventId: string) {
  return apiFetch<EventResource>(`/events/${eventId}/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getEventsOverview(workspaceSlug: string) {
  return apiFetch<EventOverview>("/events/overview/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listProjectOptions(workspaceSlug: string) {
  const payload = await apiFetch<ProjectOption[] | Paginated<ProjectOption>>("/projects/?ordering=name", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function listMemberOptions(workspaceSlug: string) {
  const payload = await apiFetch<MemberOption[] | Paginated<MemberOption>>("/members/?ordering=last_name", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function createEvent(workspaceSlug: string, payload: EventFormPayload) {
  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      body.append(key, value);
      return;
    }
    body.append(key, String(value));
  });

  return apiFetch<EventResource>("/events/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body
  });
}

export async function publishEvent(workspaceSlug: string, eventId: string) {
  return apiFetch<EventResource>(`/events/${eventId}/publish/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export async function cancelEvent(workspaceSlug: string, eventId: string) {
  return apiFetch<EventResource>(`/events/${eventId}/cancel/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}
