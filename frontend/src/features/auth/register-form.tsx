"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
    passwordConfirmation: z.string(),
    acceptedTerms: z.boolean().refine(Boolean)
  })
  .refine((data) => data.password === data.passwordConfirmation, { path: ["passwordConfirmation"] });

type RegisterValues = z.infer<typeof schema>;

export function RegisterForm() {
  const form = useForm<RegisterValues>({ resolver: zodResolver(schema) });

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-6">
      <form className="grid gap-4 rounded-card border border-border bg-white p-6 shadow-sm" onSubmit={form.handleSubmit(() => undefined)}>
        <div>
          <h1 className="text-2xl font-bold">Creer mon compte</h1>
          <p className="text-sm text-slate-500">Inscription securisee, validation serveur requise.</p>
        </div>
        <input className="min-h-11 rounded-md border px-3" placeholder="Prenom" {...form.register("firstName")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Nom" {...form.register("lastName")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Email" type="email" {...form.register("email")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Telephone" type="tel" {...form.register("phone")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Mot de passe" type="password" {...form.register("password")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Confirmation" type="password" {...form.register("passwordConfirmation")} />
        <label className="flex gap-2 text-sm">
          <input type="checkbox" {...form.register("acceptedTerms")} />
          En creant votre compte, vous acceptez les Conditions d'utilisation et la Politique de confidentialite de NOVEX.
        </label>
        <Button type="submit">Creer mon compte</Button>
      </form>
    </main>
  );
}
