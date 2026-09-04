"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#10131a] text-[#0f172a]">
      <div className={`fixed inset-0 z-50 overflow-hidden bg-[#07162d] transition duration-700 ${showSplash ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/brand/novex-splash.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(5,17,37,0.08),rgba(5,17,37,0.24))]" />
        <div className="absolute inset-x-0 bottom-12 grid place-items-center px-10">
          <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/15 shadow-lg shadow-black/20">
            <div className="h-full w-2/3 rounded-full bg-[#f57f17] motion-safe:animate-pulse" />
          </div>
        </div>
      </div>

      <section className="min-h-screen bg-[#f8fafc] md:bg-[radial-gradient(circle_at_center,#263142_1px,transparent_1px)] md:[background-size:18px_18px]">
        <div className="mx-auto flex min-h-screen w-full flex-col bg-[#f8fafc] md:max-w-[430px] md:shadow-2xl md:shadow-black/30">
          <div className="flex min-h-12 items-center gap-2 bg-[#0f172a] px-4 text-xs font-semibold text-white shadow-lg">
            <img className="size-5 rounded-sm bg-white object-cover" src="/brand/novex-favicon.jpg" alt="NOVEX" />
            Installer NOVEX pour une experience optimale
            <X className="ml-auto size-4 text-white/70" />
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-center bg-white px-7 py-10 text-center">
              <div className="mx-auto mb-10 h-1 w-28 rounded-full bg-[#0f7ff2]" />
              <img className="mx-auto mb-8 h-auto w-full max-w-[260px] rounded-lg object-contain" src="/brand/novex-logo.jpg" alt="NOVEX - Synchronisation et croissance des associations" />

              <h1 className="text-2xl font-bold tracking-normal">Bienvenue sur NOVEX</h1>
              <p className="mx-auto mt-4 max-w-[280px] text-sm leading-7 text-slate-500">
                La solution premium pour la gestion simplifiee de votre association.
              </p>

              <Button asChild className="mt-10 min-h-12 w-full bg-[#0f7ff2] text-white hover:bg-[#0b63c4]">
                <Link href="/auth/login">
                  Commencer
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="link" className="mt-3 text-[#0f7ff2]">
                <Link href="/auth/register">Creer un compte</Link>
              </Button>
            </div>

            <div className="flex min-h-14 items-center justify-center gap-2 border-t border-slate-200 px-4 text-center text-[11px] font-medium text-slate-500">
              <BellRing className="size-3.5" />
              Securise par l'infrastructure NOVEX Enterprise
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
