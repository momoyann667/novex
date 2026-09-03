import { apiFetch } from "@/lib/api/client";
import type { PeriodCode, DashboardOverview } from "./types";

export function getDashboardOverview(workspaceSlug: string, period: PeriodCode) {
  return apiFetch<DashboardOverview>(`/dashboard/overview/?period=${period}`, {
    headers: { "X-Workspace": workspaceSlug },
    cache: "no-store",
  });
}
