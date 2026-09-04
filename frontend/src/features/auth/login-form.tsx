"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Eye, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type LoginValues = z.infer<typeof schema>;

type LoginPayload = {
  default_workspace?: {
    slug?: string;
  } | null;
};

function errorMessageFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Impossible de se connecter pour le moment.";
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") {
    return data.message;
  }
  if (typeof data.detail === "string") {
    return data.detail;
  }

  const firstError = Object.entries(data).find(([, value]) => Array.isArray(value) || typeof value === "string");
  if (!firstError) {
    return "Impossible de se connecter pour le moment.";
  }

  const [field, value] = firstError;
  const message = Array.isArray(value) ? value.join(" ") : value;
  return `${field}: ${message}`;
}

export function LoginForm() {
  const form = useForm<LoginValues>({ resolver: zodResolver(schema) });
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(values: LoginValues) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });
      const payload = (await response.json().catch(() => null)) as LoginPayload | null;

      if (!response.ok) {
        throw new ApiError(errorMessageFromPayload(payload), response.status);
      }

      const workspaceSlug = payload?.default_workspace?.slug;
      if (!workspaceSlug) {
        router.push("/workspace/new");
        return;
      }

      router.push(`/app/${workspaceSlug}/dashboard`);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Impossible de se connecter pour le moment.");
    }
  }

  return (
    <main className="min-h-screen bg-[#10131a] bg-[radial-gradient(circle_at_center,#3a4558_1px,transparent_1px)] [background-size:18px_18px] text-[#0f172a]">
      <section className="mx-auto flex min-h-screen w-full items-stretch justify-center md:max-w-[430px] md:items-center md:px-6 md:py-8">
        <form
          className="flex min-h-screen w-full flex-col bg-white px-7 py-10 shadow-2xl shadow-black/30 md:min-h-0 md:rounded-[22px] md:border md:border-slate-200 md:p-7"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="rounded-[18px] border border-slate-200 bg-white px-7 py-9 md:px-8">
            <div className="text-center">
              <img className="mx-auto h-auto w-full max-w-[250px] object-contain" src="/brand/novex-logo.jpg" alt="NOVEX - Synchronisation et croissance des associations" />
              <h1 className="mt-4 text-lg font-medium tracking-normal text-slate-800">Connexion a votre espace securise</h1>
            </div>

            <div className="mt-8 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Email
                <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <Mail className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-base font-normal outline-none placeholder:text-slate-500" placeholder="nom@exemple.com" type="email" {...form.register("email")} />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Mot de passe
                <span className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <LockKeyhole className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-base font-normal outline-none placeholder:text-slate-500" placeholder="********" type="password" {...form.register("password")} />
                  <Eye className="size-5" />
                </span>
              </label>
            </div>

            <div className="mt-2 flex justify-end">
              <Button type="button" variant="link" className="text-xs font-semibold text-[#005fd6]">
                Mot de passe oublie ?
              </Button>
            </div>

            {submitError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{submitError}</p>
            ) : null}

            <Button disabled={form.formState.isSubmitting} type="submit" className="mt-5 min-h-12 w-full bg-[#0863cf] text-white hover:bg-[#0755b3]">
              {form.formState.isSubmitting ? "Connexion en cours..." : "Se connecter"}
            </Button>

            <div className="my-7 flex items-center gap-4 text-xs text-slate-700">
              <span className="h-px flex-1 bg-slate-200" />
              Ou continuer avec
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-3">
              <Button type="button" variant="outline" className="min-h-11 border-slate-300 bg-white text-slate-950">
                <span className="font-black text-[#0f9d58]">G</span>
                Google
              </Button>
              <Button type="button" variant="outline" className="min-h-11 border-slate-300 bg-white text-slate-950">
                <span className="font-black text-black">A</span>
                Apple
              </Button>
            </div>

            <p className="mt-8 text-center text-sm text-slate-700">
              Pas encore de compte ?{" "}
              <Link href="/auth/register" className="font-semibold text-[#005fd6]">
                S'inscrire
              </Link>
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
