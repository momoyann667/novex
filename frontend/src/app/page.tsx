import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-6 py-16">
      <section className="grid gap-4">
        <p className="text-sm font-semibold text-blue-700">NOVEX</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-normal md:text-6xl">
          Le socle SaaS pour gerer les organisations avec clarte.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Multi-tenant, PWA, securise et pret pour les modules membres, cotisations, finance, projets et rapports.
        </p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/auth/register">Creer mon compte</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/auth/login">Se connecter</Link>
        </Button>
      </div>
    </main>
  );
}
