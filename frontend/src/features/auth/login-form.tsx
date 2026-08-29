"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type LoginValues = z.infer<typeof schema>;

export function LoginForm() {
  const form = useForm<LoginValues>({ resolver: zodResolver(schema) });

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-6">
      <form className="grid gap-4 rounded-card border border-border bg-white p-6 shadow-sm" onSubmit={form.handleSubmit(() => undefined)}>
        <div>
          <h1 className="text-2xl font-bold">Se connecter a NOVEX</h1>
          <p className="text-sm text-slate-500">Accedez a votre workspace.</p>
        </div>
        <input className="min-h-11 rounded-md border px-3" placeholder="Email" type="email" {...form.register("email")} />
        <input className="min-h-11 rounded-md border px-3" placeholder="Mot de passe" type="password" {...form.register("password")} />
        <Button type="submit">Se connecter</Button>
        <Button type="button" variant="link">Mot de passe oublie ?</Button>
      </form>
    </main>
  );
}
