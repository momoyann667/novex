"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Grid2X2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#10131a] text-[#0f172a]">
      <div className={`fixed inset-0 z-50 grid place-items-center bg-[#0b1020] transition duration-500 ${showSplash ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="grid place-items-center gap-5 text-white">
          <div className="grid size-20 place-items-center rounded-[22px] bg-[#0f7ff2] shadow-2xl shadow-blue-700/30">
            <Grid2X2 className="size-9" />
          </div>
          <div className="text-5xl font-black tracking-normal">NOVEX</div>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-2/3 rounded-full bg-[#0f7ff2] motion-safe:animate-pulse" />
          </div>
        </div>
      </div>

      <section className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_center,#263142_1px,transparent_1px)] [background-size:18px_18px] px-5 py-8">
        <div className="w-full max-w-[390px]">
          <div className="mb-3 flex min-h-10 items-center gap-2 rounded-t-md bg-[#0f172a] px-3 text-xs font-semibold text-white shadow-lg">
            <span className="grid size-5 place-items-center rounded-sm bg-white text-[10px] font-black text-[#0f172a]">N</span>
            Installer NOVEX pour une experience optimale
            <X className="ml-auto size-4 text-white/70" />
          </div>

          <div className="rounded-md border border-slate-200 bg-[#f8fafc] p-3 shadow-2xl shadow-black/30">
            <div className="rounded-md border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
              <div className="mx-auto mb-7 h-1 w-28 rounded-full bg-[#0f7ff2]" />
              <div className="mb-7 flex items-center justify-center gap-2">
                <Grid2X2 className="size-5 text-[#0f7ff2]" />
                <strong className="text-lg tracking-normal">NOVEX</strong>
              </div>

              <div className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100 shadow-inner">
                <Sparkles className="size-7 text-[#475569]" />
              </div>

              <h1 className="mt-7 text-xl font-bold tracking-normal">Bienvenue sur NOVEX</h1>
              <p className="mx-auto mt-3 max-w-[260px] text-sm leading-6 text-slate-500">
                La solution premium pour la gestion simplifiee de votre association.
              </p>

              <Button asChild className="mt-7 min-h-12 w-full bg-[#0f7ff2] text-white hover:bg-[#0b63c4]">
                <Link href="/auth/login">
                  Commencer
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="link" className="mt-3 text-[#0f7ff2]">
                <Link href="/auth/register">Creer un compte</Link>
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-slate-500">
              <BellRing className="size-3.5" />
              Securise par l'infrastructure NOVEX Enterprise
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
