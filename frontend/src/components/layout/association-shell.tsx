import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Bot, Calendar, CreditCard, FileText, FolderKanban, Home, Landmark, Menu, Search, Settings, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { label: "Dashboard", path: "dashboard", icon: Home, permission: "dashboard.view" },
  { label: "Membres", path: "members", icon: Users, permission: "members.view" },
  { label: "Cotisations", path: "contributions", icon: CreditCard, permission: "contributions.view" },
  { label: "Paiements", path: "payments", icon: CreditCard, permission: "payments.view", plan: "NOVEX_START" },
  { label: "Finances", path: "finance", icon: Wallet, permission: "finance.view", plan: "NOVEX_START" },
  { label: "Budgets", path: "budgets", icon: Landmark, permission: "budgets.view", plan: "NOVEX_START" },
  { label: "Transactions", path: "finance/transactions", icon: Wallet, permission: "finance.view", plan: "NOVEX_START" },
  { label: "Recettes", path: "finance/income", icon: Wallet, permission: "finance.create_income" },
  { label: "Depenses", path: "finance/expenses", icon: Wallet, permission: "finance.create_expense" },
  { label: "Categories", path: "finance/categories", icon: FileText, permission: "finance.manage_categories" },
  { label: "Projets", path: "projects", icon: FolderKanban, permission: "projects.view", plan: "NOVEX_START" },
  { label: "Evenements", path: "events", icon: Calendar, permission: "events.view", plan: "NOVEX_START" },
  { label: "Documents", path: "documents", icon: FileText, permission: "documents.view" },
  { label: "Rapports", path: "reports", icon: FileText, permission: "reports.view", plan: "NOVEX_PRO" },
  { label: "Assistant IA", path: "assistant", icon: Bot, permission: "assistant.view", plan: "NOVEX_PRO" },
  { label: "Parametres", path: "settings", icon: Settings, permission: "settings.view" }
] as const;

export function AssociationShell({ children, workspaceSlug }: Readonly<{ children: ReactNode; workspaceSlug: string }>) {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:grid md:grid-cols-[272px_minmax(0,1fr)] md:pb-0">
      <aside className="hidden border-r border-border bg-white p-5 md:block">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-blue-700 font-bold text-white">N</div>
          <strong>NOVEX</strong>
        </div>
        <Button variant="outline" className="mb-5 w-full justify-start">
          Association active
        </Button>
        <nav className="grid gap-1">
          {nav.map(({ label, path, icon: Icon }, index) => (
            <Link
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm ${index === 0 ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}
              href={`/app/${workspaceSlug}/${path}`}
              key={path}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>
        <header className="sticky top-0 z-20 hidden min-h-16 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur md:flex md:px-6">
          <div className="flex items-center gap-3">
            <Button className="md:hidden" variant="ghost" aria-label="Menu">
              <Menu className="size-5" />
            </Button>
            <div>
              <strong>Association active</strong>
              <div className="text-xs text-slate-500">Workspace: {workspaceSlug}</div>
            </div>
          </div>
          <div className="hidden min-w-72 items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-500 lg:flex">
            <Search className="size-4" />
            Rechercher dans NOVEX...
            <span className="ml-auto rounded border px-1.5 text-xs">Ctrl K</span>
          </div>
          <Button variant="outline" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>
        </header>
        <main className="p-0 md:p-6">{children}</main>
      </section>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] md:hidden">
        {([
          ["Dashboard", "dashboard", Home],
          ["Membres", "members", Users],
          ["Cotisations", "contributions", CreditCard],
          ["Assi...", "assistant", Bot],
          ["Plus", "settings", Menu]
        ] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>).map(([label, path, Icon], index) => (
          <Link className={`grid min-h-16 place-items-center rounded-md text-[10px] font-bold ${index === 0 ? "text-blue-700" : "text-slate-600"}`} href={`/app/${workspaceSlug}/${path}`} key={path}>
            <span className={`grid size-8 place-items-center rounded-md ${index === 0 ? "bg-blue-50" : ""}`}>
              <Icon className="size-5" />
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
