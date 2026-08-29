import Link from "next/link";
import type { ReactNode } from "react";

const nav = ["Dashboard", "Associations", "Utilisateurs", "Abonnements", "Paiements", "Revenus", "Analytics", "Support", "Notifications", "Configuration"];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid min-h-screen grid-cols-[264px_minmax(0,1fr)] bg-slate-50">
      <aside className="bg-slate-950 p-5 text-white">
        <strong>NOVEX ADMIN</strong>
        <nav className="mt-6 grid gap-1">
          {nav.map((item, index) => (
            <Link className={`rounded-md px-3 py-2 text-sm ${index === 0 ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10"}`} href="/admin" key={item}>
              {item}
            </Link>
          ))}
        </nav>
      </aside>
      <section>
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-white px-6">
          <strong>NOVEX ADMIN</strong>
          <span className="text-sm text-slate-500">Acces reserve equipe interne</span>
        </header>
        <main className="p-6">{children}</main>
      </section>
    </div>
  );
}
