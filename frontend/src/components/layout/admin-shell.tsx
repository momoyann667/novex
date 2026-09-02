"use client";

import { Activity, BarChart3, Bell, Building2, CreditCard, FileSearch, Gauge, Layers3, Search, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  { label: "Dashboard", href: "/admin", icon: Gauge },
  { label: "Associations", href: "/admin/associations", icon: Building2 },
  { label: "Utilisateurs", href: "/admin/users", icon: Users },
  { label: "Abonnements", href: "/admin/subscriptions", icon: Layers3 },
  { label: "Paiements SaaS", href: "/admin/payments", icon: CreditCard },
  { label: "Plans & Offres", href: "/admin/plans", icon: BarChart3 },
  { label: "Activite", href: "/admin/activity", icon: Activity },
  { label: "Rapports", href: "/admin/reports", icon: FileSearch },
  { label: "Audit", href: "/admin/audit", icon: ShieldCheck },
  { label: "Parametres", href: "/admin/settings", icon: Settings }
];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen min-w-[1180px] grid-cols-[280px_minmax(0,1fr)] bg-slate-100 text-slate-950">
      <aside className="sticky top-0 h-screen border-r border-slate-800 bg-slate-950 px-5 py-6 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-blue-600 text-sm font-black">N</div>
          <div>
            <strong className="block text-lg">NOVEX Admin</strong>
            <span className="text-xs font-semibold text-slate-400">Console interne</span>
          </div>
        </div>
        <nav className="mt-8 grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`} href={item.href} key={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-md border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
          <strong className="block text-white">Acces reserve</strong>
          Equipe interne NOVEX uniquement.
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <strong className="text-base">Back-office NOVEX</strong>
            <p className="text-xs font-semibold text-slate-500">Supervision globale de la plateforme SaaS</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex h-10 w-[360px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              <Search className="size-4" />
              <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" placeholder="Recherche globale..." />
            </label>
            <button className="relative grid size-10 place-items-center rounded-md border border-slate-200 bg-white" type="button" aria-label="Notifications">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-600" />
            </button>
            <div className="rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white">Admin</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1560px] p-8">{children}</main>
      </section>
    </div>
  );
}
