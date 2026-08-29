export type PeriodCode = "today" | "week" | "month" | "quarter" | "year" | "previous_year" | "custom";

export interface DashboardOverview {
  workspace: {
    id: number | string;
    name: string;
    slug: string;
    currency: string;
  };
  period: {
    code: PeriodCode;
    label: string;
    server_now: string;
  };
  kpis: {
    finance: {
      current_balance: string | null;
      revenues: string | null;
      expenses: string | null;
      net_flow: string | null;
      masked: boolean;
    };
    members: {
      total: number;
      active: number;
      active_rate: number;
      new_members: number;
      contribution_current: number;
      contribution_current_rate: number;
    };
    contributions: {
      objective: string | null;
      collected: string | null;
      remaining: string | null;
      recovery_rate: number;
      late_members: number;
    };
    projects: {
      total: number;
      active: number;
      at_risk: number;
      late: number;
    };
    events: {
      upcoming: number;
    };
    documents: {
      recent: number;
    };
  };
  series: {
    financial_overview: Array<{ label: string; revenues: number; expenses: number; net: number }>;
    expense_breakdown: Array<{ label: string; value: number; percentage: number }>;
    revenue_breakdown: Array<{ label: string; value: number; percentage: number }>;
    cash_flow: { in: number; out: number; net: number };
  };
  alerts: Array<{ title: string; description: string; level: "info" | "warning" | "danger" }>;
  activity: Array<{ title: string; description: string; occurred_at: string }>;
  insights: Array<{ title: string; description: string }>;
  empty_state: boolean;
  last_updated_at: string;
}
