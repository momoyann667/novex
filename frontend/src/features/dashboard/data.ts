import type { DashboardOverview } from "./types";

export const emptyDashboardOverview: DashboardOverview = {
  workspace: {
    id: "preview",
    name: "Workspace actif",
    slug: "workspace",
    currency: "XOF",
  },
  period: {
    code: "month",
    label: "Ce mois",
    server_now: new Date().toISOString(),
  },
  kpis: {
    finance: {
      current_balance: "0 XOF",
      revenues: "0 XOF",
      expenses: "0 XOF",
      net_flow: "0 XOF",
      masked: false,
    },
    members: {
      total: 0,
      active: 0,
      active_rate: 0,
      new_members: 0,
      contribution_current: 0,
      contribution_current_rate: 0,
    },
    contributions: {
      objective: "0 XOF",
      collected: "0 XOF",
      remaining: "0 XOF",
      recovery_rate: 0,
      late_members: 0,
    },
    projects: { total: 0, active: 0, at_risk: 0, late: 0 },
    events: { upcoming: 0 },
    documents: { recent: 0 },
  },
  series: {
    financial_overview: [],
    expense_breakdown: [],
    revenue_breakdown: [],
    cash_flow: { in: 0, out: 0, net: 0 },
  },
  alerts: [],
  activity: [],
  insights: [],
  empty_state: true,
  last_updated_at: new Date().toISOString(),
};
