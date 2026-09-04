"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Eye, LockKeyhole, Mail, RotateCcw, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api/client";

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
  requires_otp?: boolean;
  otp_delivery?: {
    channel: string;
    destination: string;
    expires_at: string;
  };
  default_workspace?: {
    slug?: string;
  } | null;
};

type LoginPayload = {
  default_workspace?: {
    slug?: string;
  } | null;
};

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() || fullName.trim();
  const lastName = parts.join(" ") || firstName;
  return { firstName, lastName };
}

export function RegisterForm() {
  const form = useForm<RegisterValues>({ resolver: zodResolver(schema) });
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDestination, setOtpDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  async function onSubmit(values: RegisterValues) {
    setSubmitError(null);
    const { firstName, lastName } = splitFullName(values.fullName);

    try {
      const payload = await apiFetch<RegisteredUser>("/auth/register/", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: values.email,
          password: values.password,
          password_confirmation: values.passwordConfirmation,
          accepted_terms: values.acceptedTerms
        })
      });

      if (payload.requires_otp) {
        setOtpEmail(payload.email || values.email);
        setOtpDestination(payload.otp_delivery?.destination || payload.email || values.email);
        setOtpNotice("Un code de verification vient d'etre envoye. Saisis-le pour activer ton compte.");
        return;
      }

      const workspaceSlug = payload.default_workspace?.slug;
      router.push(workspaceSlug ? `/app/${workspaceSlug}/dashboard` : "/workspace/new");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Impossible de creer le compte pour le moment.");
    }
  }

  async function verifyOtp() {
    setSubmitError(null);
    setIsVerifyingOtp(true);

    try {
      const payload = await apiFetch<LoginPayload>("/auth/otp/verify/", {
        method: "POST",
        body: JSON.stringify({
          email: otpEmail,
          code: otpCode
        })
      });

      const workspaceSlug = payload.default_workspace?.slug;
      router.push(workspaceSlug ? `/app/${workspaceSlug}/dashboard` : "/workspace/new");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Code OTP incorrect ou expire.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function resendOtp() {
    setSubmitError(null);
    setIsResendingOtp(true);

    try {
      const response = await apiFetch<{ otp_delivery?: { destination?: string } }>("/auth/otp/request/", {
        method: "POST",
        body: JSON.stringify({ email: otpEmail })
      });
      setOtpDestination(response.otp_delivery?.destination || otpDestination);
      setOtpNotice("Un nouveau code OTP a ete envoye.");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Impossible de renvoyer le code OTP pour le moment.");
    } finally {
      setIsResendingOtp(false);
    }
  }

  if (otpEmail) {
    return (
      <main className="min-h-screen bg-[#10131a] bg-[radial-gradient(circle_at_center,#3a4558_1px,transparent_1px)] [background-size:18px_18px] text-[#0f172a]">
        <section className="mx-auto flex min-h-screen w-full items-stretch justify-center md:max-w-[430px] md:items-center md:px-6 md:py-8">
          <div className="flex min-h-screen w-full flex-col bg-white px-7 py-8 shadow-2xl shadow-black/30 md:min-h-0 md:rounded-[22px] md:border md:border-slate-200 md:p-5">
            <div className="flex h-full flex-col rounded-[18px] border border-slate-200 bg-white px-6 py-7 md:px-7">
              <button className="mb-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600" type="button" onClick={() => setOtpEmail("")}>
                <ArrowLeft className="size-4" />
                Retour
              </button>
              <div className="text-center">
                <img className="mx-auto h-auto w-full max-w-[250px] object-contain" src="/brand/novex-logo.jpg" alt="NOVEX - Synchronisation et croissance des associations" />
                <div className="mx-auto mt-5 flex size-14 items-center justify-center rounded-full bg-blue-50 text-[#005fd6]">
                  <ShieldCheck className="size-7" />
                </div>
                <h1 className="mt-5 text-2xl font-bold tracking-normal text-slate-800">Verification OTP</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Entre le code recu sur <span className="font-semibold text-slate-700">{otpDestination || otpEmail}</span>.
                </p>
              </div>

              <div className="mt-8 grid gap-4">
                <label className="grid gap-1.5 text-sm font-bold text-slate-950">
                  Code de verification
                  <input
                    className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-[0.28em] text-slate-950 outline-none focus:border-[#005fd6] focus:ring-2 focus:ring-blue-100"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
                {otpNotice ? <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{otpNotice}</p> : null}
                {submitError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{submitError}</p> : null}
              </div>

              <div className="mt-auto grid gap-3 pt-8">
                <Button disabled={isVerifyingOtp || otpCode.length < 4} type="button" className="min-h-12 w-full bg-[#005fd6] text-white hover:bg-[#0050b5]" onClick={verifyOtp}>
                  {isVerifyingOtp ? "Verification..." : "Verifier et continuer"}
                  <ArrowRight className="size-4" />
                </Button>
                <Button disabled={isResendingOtp} type="button" variant="outline" className="min-h-11 border-slate-300 bg-white text-slate-950" onClick={resendOtp}>
                  {isResendingOtp ? "Envoi..." : "Renvoyer le code"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
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
              <img className="mx-auto h-auto w-full max-w-[250px] object-contain" src="/brand/novex-logo.jpg" alt="NOVEX - Synchronisation et croissance des associations" />
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

            {submitError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{submitError}</p> : null}

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
