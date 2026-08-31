"use client";

import { Archive, ArrowLeft, Briefcase, CalendarDays, CreditCard, Edit, FileText, Mail, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tabs = ["Informations", "Cotisations", "Paiements", "Activite", "Documents"];

type MemberProfile = {
  id: string;
  number: string;
  name: string;
  email: string;
  phone: string;
  function: string;
  category: string;
  city: string;
  country: string;
  joinedAt: string;
  status: "Actif" | "Inactif" | "Suspendu" | "Archive";
  contribution: "A jour" | "En retard" | "Partiel" | "Aucune cotisation";
  plan: string;
  bio: string;
  avatar: string;
  initials: string;
  activities: Array<{ title: string; detail: string; date: string; icon: "event" | "payment" | "document" }>;
};

const profiles: MemberProfile[] = [
  {
    id: "1",
    number: "NVX-2024-001",
    name: "Amara Diallo",
    email: "amara.diallo@example.com",
    phone: "+225 07 00 00 00 01",
    function: "President",
    category: "Bureau",
    city: "Abidjan",
    country: "Cote d'Ivoire",
    joinedAt: "2024-01-15",
    status: "Actif",
    contribution: "A jour",
    plan: "Premium",
    bio: "President actif, responsable de la coordination du bureau et du pilotage strategique de l'association.",
    avatar: "bg-[linear-gradient(135deg,#0f172a,#64748b)]",
    initials: "AD",
    activities: [
      { title: "Assemblee generale", detail: "Animateur", date: "Aout 31", icon: "event" },
      { title: "Cotisation annuelle", detail: "Payee", date: "Aout 12", icon: "payment" }
    ]
  },
  {
    id: "2",
    number: "NVX-2024-014",
    name: "Jean-Marc Oka",
    email: "jm.oka@example.com",
    phone: "+225 05 00 00 00 02",
    function: "Tresorier",
    category: "Bureau",
    city: "Yamoussoukro",
    country: "Cote d'Ivoire",
    joinedAt: "2024-03-22",
    status: "Inactif",
    contribution: "En retard",
    plan: "Standard",
    bio: "Tresorier charge du suivi financier, des cotisations et des rapports de tresorerie.",
    avatar: "bg-[linear-gradient(135deg,#dbeafe,#334155)]",
    initials: "JO",
    activities: [
      { title: "Rapport financier", detail: "Document ajoute", date: "Aout 18", icon: "document" },
      { title: "Cotisation bureau", detail: "En retard", date: "Juil 30", icon: "payment" }
    ]
  },
  {
    id: "3",
    number: "NVX-2023-089",
    name: "Koffi Kouakou",
    email: "k.kouakou@example.com",
    phone: "+225 01 00 00 00 03",
    function: "Secretaire general",
    category: "Bureau",
    city: "Bouake",
    country: "Cote d'Ivoire",
    joinedAt: "2023-11-04",
    status: "Actif",
    contribution: "Partiel",
    plan: "Premium",
    bio: "Secretaire general implique dans la documentation, les reunions et le suivi administratif.",
    avatar: "bg-[linear-gradient(135deg,#ecfeff,#0f766e)]",
    initials: "KK",
    activities: [
      { title: "Proces-verbal", detail: "Mis a jour", date: "Aout 12", icon: "document" },
      { title: "Conference annuelle", detail: "Participant", date: "Juil 22", icon: "event" }
    ]
  },
  {
    id: "4",
    number: "NVX-2025-021",
    name: "Fatou Diop",
    email: "f.diop@example.com",
    phone: "+221 77 000 00 04",
    function: "Responsable communication",
    category: "Benevole",
    city: "Dakar",
    country: "Senegal",
    joinedAt: "2025-02-18",
    status: "Actif",
    contribution: "A jour",
    plan: "Premium",
    bio: "Responsable communication, elle coordonne les annonces, les contenus publics et la mobilisation des membres.",
    avatar: "bg-[linear-gradient(135deg,#fee2e2,#7c2d12)]",
    initials: "FD",
    activities: [
      { title: "Campagne communication", detail: "Responsable", date: "Aout 25", icon: "event" },
      { title: "Cotisation 2026", detail: "Payee", date: "Aout 02", icon: "payment" }
    ]
  },
  {
    id: "5",
    number: "NVX-2025-048",
    name: "Awa Traore",
    email: "awa.traore@example.com",
    phone: "+225 07 00 00 00 05",
    function: "Membre",
    category: "Membres",
    city: "Abidjan",
    country: "Cote d'Ivoire",
    joinedAt: "2025-06-09",
    status: "Actif",
    contribution: "Aucune cotisation",
    plan: "Standard",
    bio: "Membre active dans les actions terrain et les activites communautaires de l'association.",
    avatar: "bg-[linear-gradient(135deg,#fef3c7,#92400e)]",
    initials: "AT",
    activities: [
      { title: "Integration membre", detail: "Profil cree", date: "Juin 09", icon: "document" },
      { title: "Atelier communautaire", detail: "Inscrite", date: "Juin 21", icon: "event" }
    ]
  },
  {
    id: "6",
    number: "NVX-2022-032",
    name: "Serge Nguessan",
    email: "serge.nguessan@example.com",
    phone: "+225 05 00 00 00 06",
    function: "Commissaire aux comptes",
    category: "Comite",
    city: "San Pedro",
    country: "Cote d'Ivoire",
    joinedAt: "2022-09-30",
    status: "Inactif",
    contribution: "En retard",
    plan: "Standard",
    bio: "Commissaire aux comptes, il suit les controles internes et les pieces justificatives de l'association.",
    avatar: "bg-[linear-gradient(135deg,#e0e7ff,#312e81)]",
    initials: "SN",
    activities: [
      { title: "Controle financier", detail: "En attente", date: "Aout 04", icon: "document" },
      { title: "Cotisation annuelle", detail: "En retard", date: "Juil 15", icon: "payment" }
    ]
  },
  {
    id: "7",
    number: "NVX-2021-117",
    name: "Nadia Bamba",
    email: "nadia.bamba@example.com",
    phone: "+225 01 00 00 00 07",
    function: "Membre",
    category: "Section",
    city: "Korhogo",
    country: "Cote d'Ivoire",
    joinedAt: "2021-05-12",
    status: "Suspendu",
    contribution: "Partiel",
    plan: "Standard",
    bio: "Membre de section, rattachee aux actions locales et au suivi des activites communautaires.",
    avatar: "bg-[linear-gradient(135deg,#fef2f2,#991b1b)]",
    initials: "NB",
    activities: [
      { title: "Cotisation section", detail: "Partiellement payee", date: "Aout 01", icon: "payment" },
      { title: "Reunion locale", detail: "Absente", date: "Juil 20", icon: "event" }
    ]
  },
  {
    id: "8",
    number: "NVX-2020-004",
    name: "Paul Ehouman",
    email: "paul.ehouman@example.com",
    phone: "+225 07 00 00 00 08",
    function: "Ancien membre",
    category: "Archives",
    city: "Abidjan",
    country: "Cote d'Ivoire",
    joinedAt: "2020-08-18",
    status: "Archive",
    contribution: "A jour",
    plan: "Archive",
    bio: "Ancien membre archive, conserve dans NOVEX pour garder l'historique administratif et financier.",
    avatar: "bg-[linear-gradient(135deg,#f1f5f9,#475569)]",
    initials: "PE",
    activities: [
      { title: "Archivage membre", detail: "Historique conserve", date: "Juin 12", icon: "document" },
      { title: "Cotisation finale", detail: "Payee", date: "Mai 28", icon: "payment" }
    ]
  }
];

function profileFor(memberId: string) {
  return profiles.find((profile) => profile.id === memberId) || profiles[0];
}

function statusClass(status: MemberProfile["status"]) {
  return {
    Actif: "bg-emerald-50 text-emerald-700",
    Inactif: "bg-slate-100 text-slate-700",
    Suspendu: "bg-amber-50 text-amber-700",
    Archive: "bg-red-50 text-red-700"
  }[status];
}

function contributionLabelClass(status: MemberProfile["contribution"]) {
  return status === "A jour" ? "text-emerald-700" : status === "En retard" ? "text-red-700" : "text-amber-700";
}

function activityIcon(icon: MemberProfile["activities"][number]["icon"]) {
  if (icon === "payment") return CreditCard;
  if (icon === "document") return FileText;
  return CalendarDays;
}

export function MemberDetailView({ memberId }: Readonly<{ memberId: string }>) {
  const router = useRouter();
  const profile = profileFor(memberId);

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:rounded-[28px] md:px-6">
      <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>

      <section className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
        <div className="mx-auto grid size-24 place-items-center rounded-full bg-slate-100 p-1">
          <div className={`relative grid size-20 place-items-center rounded-full ${profile.avatar}`}>
            <span className="text-xl font-black text-white">{profile.initials}</span>
            <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-white bg-blue-700 text-white">
              <ShieldCheck className="size-4" />
            </span>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-normal">{profile.name}</h1>
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            <Star className="size-3" />
            Membre {profile.plan}
          </span>
        </div>
        <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-slate-600">{profile.bio}</p>
        <Button className="mt-5 min-h-12 w-full bg-slate-950 text-white hover:bg-slate-800 md:max-w-sm" type="button">
          <Edit className="size-4" />
          Modifier le profil
        </Button>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-black tracking-normal">Informations Personnelles</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div className="flex gap-3">
            <Mail className="mt-1 size-5 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-500">Email</p>
              <a className="font-semibold text-slate-900" href={`mailto:${profile.email}`}>{profile.email}</a>
            </div>
          </div>
          <div className="flex gap-3">
            <Phone className="mt-1 size-5 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-500">Telephone</p>
              <a className="font-semibold text-slate-900" href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="mt-1 size-5 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-500">Localisation</p>
              <p className="font-semibold">{profile.city}, {profile.country}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Briefcase className="mt-1 size-5 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-500">Role</p>
              <p className="font-semibold">{profile.function}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-black tracking-normal">Adhesion</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex min-h-11 items-center justify-between rounded-md bg-slate-50 px-3">
            <span className="font-bold text-slate-500">Statut</span>
            <span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass(profile.status)}`}>{profile.status}</span>
          </div>
          <div className="flex min-h-11 items-center justify-between rounded-md bg-slate-50 px-3">
            <span className="font-bold text-slate-500">Membre depuis</span>
            <strong>{new Intl.DateTimeFormat("fr-FR").format(new Date(profile.joinedAt))}</strong>
          </div>
          <div className="flex min-h-11 items-center justify-between rounded-md bg-slate-50 px-3">
            <span className="font-bold text-slate-500">Identifiant</span>
            <strong>{profile.number}</strong>
          </div>
          <div className="flex min-h-11 items-center justify-between rounded-md bg-slate-50 px-3">
            <span className="font-bold text-slate-500">Plan</span>
            <span className="rounded bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{profile.plan}</span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal">Activites Recentes</h2>
          <button className="text-xs font-black text-blue-700" type="button">Voir tout</button>
        </div>
        <div className="mt-4 grid gap-3">
          {profile.activities.map((activity) => {
            const Icon = activityIcon(activity.icon);
            return (
              <article className="flex items-center gap-3 rounded-md bg-slate-50 p-3" key={`${activity.title}-${activity.date}`}>
                <span className="grid size-10 place-items-center rounded-md bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black">{activity.title}</h3>
                  <p className="text-xs font-semibold text-slate-500">{activity.detail}</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{activity.date}</span>
              </article>
            );
          })}
        </div>
      </section>

      <Card className="mt-4">
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          <div><p className="text-sm text-slate-500">Numero</p><strong>{profile.number}</strong></div>
          <div><p className="text-sm text-slate-500">Membre depuis</p><strong>{new Intl.DateTimeFormat("fr-FR").format(new Date(profile.joinedAt))}</strong></div>
          <div><p className="text-sm text-slate-500">Statut</p><strong>{profile.status}</strong></div>
          <div><p className="text-sm text-slate-500">Cotisation</p><strong className={contributionLabelClass(profile.contribution)}>{profile.contribution}</strong></div>
        </CardContent>
      </Card>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => <Button key={tab} type="button" variant={tab === "Informations" ? "default" : "outline"}>{tab}</Button>)}
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><FileText className="size-4" /> Historique</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-500">Les actions recentes de {profile.name} alimenteront cet historique depuis l'audit log.</CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><CreditCard className="size-4" /> Cotisations</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><p className="text-sm text-slate-500">Total du</p><strong>{profile.contribution === "En retard" ? "15 000 XOF" : "0 XOF"}</strong></div>
          <div><p className="text-sm text-slate-500">Total paye</p><strong>{profile.contribution === "A jour" ? "25 000 XOF" : "0 XOF"}</strong></div>
          <div><p className="text-sm text-slate-500">Reste</p><strong>{profile.contribution === "En retard" ? "15 000 XOF" : "0 XOF"}</strong></div>
          <div><p className="text-sm text-slate-500">Taux</p><strong>{profile.contribution === "A jour" ? "100%" : profile.contribution === "Partiel" ? "50%" : "0%"}</strong></div>
          <div><p className="text-sm text-slate-500">Derniere cotisation</p><strong>{profile.activities.find((activity) => activity.icon === "payment")?.date || "A charger"}</strong></div>
          <div><p className="text-sm text-slate-500">Prochaine echeance</p><strong>Fin du mois</strong></div>
          <div><p className="text-sm text-slate-500">Statut</p><strong className={contributionLabelClass(profile.contribution)}>{profile.contribution}</strong></div>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button type="button" variant="outline"><Edit className="size-4" /> Modifier</Button>
        <Button type="button" variant="outline"><Archive className="size-4" /> Archiver</Button>
      </div>
    </main>
  );
}
