"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Bot, Calendar, CreditCard, FileText, FolderKanban, Home, Landmark, Menu, MessageSquare, Search, Settings, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { label: "Dashboard", path: "dashboard", icon: Home, permission: "dashboard.view" },
  { label: "Mon espace", path: "member", icon: Users, permission: "member.profile.view_self" },
  { label: "Membres", path: "members", icon: Users, permission: "members.view" },
  { label: "Communication", path: "communication", icon: MessageSquare, permission: "communication.view" },
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

const primaryMobileNav = [
  ["Dashboard", "dashboard", Home],
  ["Membres", "members", Users],
  ["Cotisations", "contributions", CreditCard],
  ["Assi...", "assistant", Bot]
] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>;

const moreMobileNav = [
  { label: "Mon espace", path: "member", icon: Users },
  { label: "Communication", path: "communication", icon: MessageSquare },
  { label: "Evenements", path: "events", icon: Calendar },
  { label: "Documents", path: "documents", icon: FileText },
  { label: "Paiements", path: "payments", icon: CreditCard },
  { label: "Finances", path: "finance", icon: Wallet },
  { label: "Budgets", path: "budgets", icon: Landmark },
  { label: "Projets", path: "projects", icon: FolderKanban },
  { label: "Rapports", path: "reports", icon: FileText },
  { label: "Parametres", path: "settings", icon: Settings }
] as const;

export function AssociationShell({ children, workspaceSlug }: Readonly<{ children: ReactNode; workspaceSlug: string }>) {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  function isActive(path: string) {
    return pathname === `/app/${workspaceSlug}/${path}` || pathname.startsWith(`/app/${workspaceSlug}/${path}/`);
  }

  const moreIsActive = moreMobileNav.some(({ path }) => isActive(path));

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
          {nav.map(({ label, path, icon: Icon }) => (
            <Link
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm ${isActive(path) ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}
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
      {showMoreMenu ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" role="presentation" onClick={() => setShowMoreMenu(false)}>
          <section className="absolute inset-x-3 bottom-20 rounded-xl bg-white p-4 shadow-2xl" role="dialog" aria-label="Autres menus" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black tracking-normal text-slate-950">Plus de menus</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700" type="button" aria-label="Fermer" onClick={() => setShowMoreMenu(false)}>
                <Menu className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreMobileNav.map(({ label, path, icon: Icon }) => (
                <Link
                  className={`grid min-h-20 place-items-center rounded-lg border px-2 text-center text-xs font-black ${isActive(path) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"}`}
                  href={`/app/${workspaceSlug}/${path}`}
                  key={path}
                  onClick={() => setShowMoreMenu(false)}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] md:hidden">
        {primaryMobileNav.map(([label, path, Icon]) => (
          <Link className={`grid min-h-16 place-items-center rounded-md text-[10px] font-bold ${isActive(path) ? "text-blue-700" : "text-slate-600"}`} href={`/app/${workspaceSlug}/${path}`} key={path}>
            <span className={`grid size-8 place-items-center rounded-md ${isActive(path) ? "bg-blue-50" : ""}`}>
              <Icon className="size-5" />
            </span>
            {label}
          </Link>
        ))}
        <button className={`grid min-h-16 place-items-center rounded-md text-[10px] font-bold ${moreIsActive || showMoreMenu ? "text-blue-700" : "text-slate-600"}`} type="button" onClick={() => setShowMoreMenu((value) => !value)}>
          <span className={`grid size-8 place-items-center rounded-md ${moreIsActive || showMoreMenu ? "bg-blue-50" : ""}`}>
            <Menu className="size-5" />
          </span>
          Plus
        </button>
      </nav>
    </div>
  );
}
