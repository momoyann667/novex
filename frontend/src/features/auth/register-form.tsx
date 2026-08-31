"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { ArrowRight, Eye, LockKeyhole, Mail, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

const schema = z
  .object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
    passwordConfirmation: z.string(),
    acceptedTerms: z.boolean().refine(Boolean)
  })
  .refine((data) => data.password === data.passwordConfirmation, { path: ["passwordConfirmation"] });

type RegisterValues = z.infer<typeof schema>;

type RegisteredUser = {
  id: number;
  email: string;
};

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() || fullName.trim();
  const lastName = parts.join(" ") || firstName;
  return { firstName, lastName };
}

function errorMessageFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Impossible de creer le compte pour le moment.";
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
    return "Impossible de creer le compte pour le moment.";
  }

  const [field, value] = firstError;
  const message = Array.isArray(value) ? value.join(" ") : value;
  return `${field}: ${message}`;
}

export function RegisterForm() {
  const form = useForm<RegisterValues>({ resolver: zodResolver(schema) });
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(values: RegisterValues) {
    setSubmitError(null);
    const { firstName, lastName } = splitFullName(values.fullName);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: values.email,
          password: values.password,
          password_confirmation: values.passwordConfirmation,
          accepted_terms: values.acceptedTerms
        })
      });

      const payload = (await response.json().catch(() => null)) as RegisteredUser | unknown;
      if (!response.ok) {
        throw new ApiError(errorMessageFromPayload(payload), response.status);
      }

      router.push("/auth/login");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Impossible de creer le compte pour le moment.");
    }
  }

  return (
    <main className="min-h-screen bg-[#10131a] bg-[radial-gradient(circle_at_center,#3a4558_1px,transparent_1px)] [background-size:18px_18px] text-[#0f172a]">
      <section className="mx-auto flex min-h-screen w-full items-stretch justify-center md:max-w-[430px] md:items-center md:px-6 md:py-8">
        <form
          className="flex min-h-screen w-full flex-col bg-white px-7 py-8 shadow-2xl shadow-black/30 md:min-h-0 md:rounded-[22px] md:border md:border-slate-200 md:p-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-7 md:px-7">
            <div className="text-center">
              <div className="text-5xl font-black tracking-normal text-black">NOVEX</div>
              <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-800">Creer un compte</h1>
              <p className="mt-2 text-sm text-slate-500">Rejoignez-nous pour gerer votre association.</p>
            </div>

            <div className="mt-7 grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold text-slate-950">
                Nom complet
                <span className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <User className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-500" placeholder="Jean Dupont" {...form.register("fullName")} />
                </span>
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-slate-950">
                Email de l'association
                <span className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <Mail className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-500" placeholder="contact@association.org" type="email" {...form.register("email")} />
                </span>
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-slate-950">
                Mot de passe
                <span className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <LockKeyhole className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-500" placeholder="********" type="password" {...form.register("password")} />
                  <Eye className="size-5" />
                </span>
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-slate-950">
                Confirmation du mot de passe
                <span className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-4 text-slate-500">
                  <RotateCcw className="size-5" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-slate-500" placeholder="********" type="password" {...form.register("passwordConfirmation")} />
                </span>
              </label>

              <label className="flex gap-3 text-sm leading-6 text-slate-700">
                <input className="mt-1 size-4 rounded border-slate-300" type="checkbox" {...form.register("acceptedTerms")} />
                <span>
                  J'accepte les{" "}
                  <Link href="#" className="font-semibold text-[#005fd6]">
                    conditions d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="#" className="font-semibold text-[#005fd6]">
                    politique de confidentialite
                  </Link>
                  .
                </span>
              </label>
            </div>

            {submitError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{submitError}</p>
            ) : null}

            <Button disabled={form.formState.isSubmitting} type="submit" className="mt-5 min-h-12 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb]">
              {form.formState.isSubmitting ? "Creation en cours..." : "Creer mon compte"}
              <ArrowRight className="size-4" />
            </Button>

            <div className="my-6 flex items-center gap-4 text-xs text-slate-700">
              <span className="h-px flex-1 bg-slate-200" />
              ou s'inscrire avec
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button type="button" variant="outline" className="min-h-11 border-slate-300 bg-white text-slate-950">
                <span className="font-black text-[#4285f4]">G</span>
                Google
              </Button>
              <Button type="button" variant="outline" className="min-h-11 border-slate-300 bg-white text-slate-950">
                <span className="font-black text-black">A</span>
                Apple
              </Button>
            </div>

            <p className="mt-7 text-center text-sm text-slate-700">
              Deja un compte ?{" "}
              <Link href="/auth/login" className="font-semibold text-[#005fd6]">
                Se connecter
              </Link>
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
