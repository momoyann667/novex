"use client";

import { Eye, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";

function errorMessageFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Impossible de se connecter pour le moment.";
  }
  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;
  const firstError = Object.entries(data).find(([, value]) => Array.isArray(value) || typeof value === "string");
  if (!firstError) return "Impossible de se connecter pour le moment.";
  const [field, value] = firstError;
  const message = Array.isArray(value) ? value.join(" ") : value;
  return `${field}: ${message}`;
}

export function AdminLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(errorMessageFromPayload(payload), response.status);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de se connecter pour le moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-950">
      <section className="grid min-h-screen grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-slate-950 p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-md bg-blue-600 text-lg font-black">N</div>
            <div>
              <strong className="block text-2xl">NOVEX Admin</strong>
              <span className="text-sm font-semibold text-slate-400">Back-office interne</span>
            </div>
          </div>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">Equipe NOVEX</p>
            <h1 className="mt-5 text-5xl font-black leading-tight">Connexion a la console de supervision.</h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300">Accedez aux associations, abonnements, paiements SaaS, revenus confirmes, audits et alertes plateforme depuis un espace desktop dedie.</p>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
            <ShieldCheck className="size-5 text-blue-300" />
            Acces reserve aux administrateurs NOVEX autorises.
          </div>
        </div>
        <div className="flex items-center justify-center bg-slate-100 p-12">
          <form className="w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-8 shadow-xl" onSubmit={submit}>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">Connexion admin</p>
              <h2 className="mt-3 text-3xl font-black">Bienvenue sur NOVEX</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">Connectez-vous avec votre compte administrateur interne.</p>
            </div>
            <div className="mt-8 grid gap-5">
              <label className="grid gap-2 text-sm font-black">
                Identifiant ou email
                <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <UserRound className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="admin" />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-black">
                Mot de passe
                <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <LockKeyhole className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" type="password" />
                  <Eye className="size-5" />
                </span>
              </label>
            </div>
            {error ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p> : null}
            <button className="mt-7 min-h-12 w-full rounded-md bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50" disabled={pending} type="submit">
              {pending ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
