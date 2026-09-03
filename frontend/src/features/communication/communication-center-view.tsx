"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CalendarClock, CheckCircle2, Clock3, Copy, Eye, FileText, Mail, MessageSquare, Phone, Send, Smartphone, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CommunicationStatus = "Brouillon" | "Programmee" | "En cours" | "Envoyee" | "Partielle" | "Echec" | "Annulee";
type CommunicationType = "Annonce" | "Message collectif" | "Notification directe";
type Channel = "In-app" | "Push" | "Email" | "SMS" | "WhatsApp";

type Communication = {
  id: string;
  title: string;
  content: string;
  type: CommunicationType;
  audience: string;
  channels: Channel[];
  status: CommunicationStatus;
  recipients: number;
  delivered: number;
  read: number;
  failed: number;
  date: string;
};

const seedCommunications: Communication[] = [];

const tabs = ["Vue d'ensemble", "Annonces", "Messages", "Brouillons", "Programmes", "Historique", "Modeles", "Mes notifications"];
const channels: Channel[] = ["In-app", "Push", "Email", "SMS", "WhatsApp"];

function statusClass(status: CommunicationStatus) {
  return {
    Brouillon: "bg-slate-100 text-slate-700",
    Programmee: "bg-blue-50 text-blue-700",
    "En cours": "bg-amber-50 text-amber-700",
    Envoyee: "bg-emerald-50 text-emerald-700",
    Partielle: "bg-orange-50 text-orange-700",
    Echec: "bg-red-50 text-red-700",
    Annulee: "bg-slate-100 text-slate-500"
  }[status];
}

function readRate(item: Communication) {
  return item.delivered ? Math.round((item.read / item.delivered) * 1000) / 10 : null;
}

function channelIcon(channel: Channel) {
  if (channel === "Email") return Mail;
  if (channel === "SMS" || channel === "WhatsApp") return Phone;
  if (channel === "Push") return Smartphone;
  return Bell;
}

export function CommunicationCenterView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const [items, setItems] = useState(seedCommunications);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [showComposer, setShowComposer] = useState(false);
  const [detail, setDetail] = useState<Communication | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("Membres actifs");
  const [type, setType] = useState<CommunicationType>("Message collectif");
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["In-app"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notice, setNotice] = useState("");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    if (activeTab === "Annonces") return items.filter((item) => item.type === "Annonce");
    if (activeTab === "Messages") return items.filter((item) => item.type === "Message collectif" || item.type === "Notification directe");
    if (activeTab === "Brouillons") return items.filter((item) => item.status === "Brouillon");
    if (activeTab === "Programmes") return items.filter((item) => item.status === "Programmee");
    if (activeTab === "Historique") return items.filter((item) => item.status !== "Brouillon");
    return items;
  }, [activeTab, items]);

  const stats = useMemo(() => {
    const sent = items.reduce((total, item) => total + (item.status === "Envoyee" || item.status === "Partielle" ? item.recipients : 0), 0);
    const delivered = items.reduce((total, item) => total + item.delivered, 0);
    const read = items.reduce((total, item) => total + item.read, 0);
    const failed = items.reduce((total, item) => total + item.failed, 0);
    return {
      sent,
      delivered,
      read,
      pending: items.filter((item) => item.status === "Programmee" || item.status === "En cours").length,
      readRate: delivered ? Math.round((read / delivered) * 1000) / 10 : 0,
      failureRate: sent ? Math.round((failed / sent) * 1000) / 10 : 0,
      scheduled: items.filter((item) => item.status === "Programmee").length,
      touched: delivered
    };
  }, [items]);

  const audienceCount = 0;
  const externalChannels = selectedChannels.filter((channel) => channel !== "In-app");

  function toggleChannel(channel: Channel) {
    setSelectedChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]));
  }

  function saveCommunication(nextStatus: CommunicationStatus) {
    if (!title.trim() || !content.trim() || !selectedChannels.length) return;
    if (nextStatus !== "Brouillon") {
      const confirmed = window.confirm(`Vous etes sur le point d'envoyer ce message a ${audienceCount.toLocaleString("fr-FR")} membre(s). Confirmer ?`);
      if (!confirmed) return;
    }
    const failed = nextStatus === "Envoyee" ? externalChannels.length * audienceCount : 0;
    const nextItem: Communication = {
      id: `COM-${String(items.length + 1).padStart(3, "0")}`,
      title,
      content,
      type,
      audience,
      channels: selectedChannels,
      status: scheduledAt ? "Programmee" : nextStatus === "Brouillon" ? "Brouillon" : failed ? "Partielle" : "Envoyee",
      recipients: audienceCount,
      delivered: selectedChannels.includes("In-app") && nextStatus !== "Brouillon" ? audienceCount : 0,
      read: 0,
      failed,
      date: scheduledAt ? new Intl.DateTimeFormat("fr-FR").format(new Date(scheduledAt)) : new Intl.DateTimeFormat("fr-FR").format(new Date())
    };
    setItems((current) => [nextItem, ...current]);
    setNotice(nextItem.status === "Programmee" ? `Communication programmee pour ${nextItem.date}.` : nextItem.status === "Partielle" ? "Communication traitee. Certains canaux externes sont non configures." : nextItem.status === "Brouillon" ? "Brouillon enregistre." : `Communication envoyee a ${audienceCount.toLocaleString("fr-FR")} membre(s).`);
    setTitle("");
    setContent("");
    setScheduledAt("");
    setSelectedChannels(["In-app"]);
    setShowComposer(false);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:rounded-[28px] md:px-6">
      <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-blue-700"><MessageSquare className="size-4" /> Communication</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal">Centre de communication</h1>
          <p className="mt-2 text-sm font-medium leading-5 text-slate-600">Annonces, messages collectifs, notifications et historique centralises.</p>
        </div>
        <Button className="min-h-12 px-5" type="button" onClick={() => setShowComposer(true)}>
          <Send className="size-4" />
          Composer
        </Button>
      </section>

      {notice ? <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{notice}</p> : null}

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Messages envoyes", stats.sent.toLocaleString("fr-FR"), Send],
          ["Messages delivres", stats.delivered.toLocaleString("fr-FR"), CheckCircle2],
          ["Messages lus", stats.read.toLocaleString("fr-FR"), Eye],
          ["En attente", stats.pending.toLocaleString("fr-FR"), Clock3],
          ["Taux de lecture", `${stats.readRate}%`, Bell]
        ].map(([label, value, Icon]) => (
          <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label as string}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-600">{label as string}</span>
              <Icon className="size-7 text-slate-200" />
            </div>
            <div className="mt-3 text-3xl font-black tracking-normal">{value as string}</div>
          </div>
        ))}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">Activite 30 jours</p>
          <div className="mt-3 flex h-14 items-end gap-1">
            {[20, 44, 35, 62, 41, 78, 56, 88, 60, 72].map((height, index) => <span className="w-full rounded-t bg-blue-600" style={{ height: `${height}%` }} key={index} />)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">Membres touches</p>
          <p className="mt-2 text-2xl font-black">{stats.touched.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Base sur les audiences reelles disponibles.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">Canaux indisponibles</p>
          <p className="mt-2 text-2xl font-black text-amber-700">Email, SMS, WhatsApp</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Providers non configures.</p>
        </div>
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Navigation communication">
        {tabs.map((tab) => (
          <button className={`min-w-fit rounded-full px-4 py-2 text-xs font-black shadow-sm ${activeTab === tab ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`} type="button" key={tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Modeles" ? (
        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {["Rappel reunion mensuelle", "Convocation assemblee generale", "Message de bienvenue"].map((template) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={template}>
              <FileText className="size-6 text-blue-700" />
              <h2 className="mt-3 text-lg font-black">{template}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">Variables supportees : first_name, last_name, association_name.</p>
              <Button className="mt-4 min-h-10 px-4" type="button" variant="outline" onClick={() => { setTitle(template); setContent("Bonjour {{first_name}}, message de {{association_name}}."); setShowComposer(true); }}>
                <Copy className="size-4" />
                Utiliser
              </Button>
            </article>
          ))}
        </section>
      ) : activeTab === "Mes notifications" ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Mes notifications</h2>
            <Button className="min-h-10 px-3 text-xs" type="button" variant="outline" onClick={() => setReadNotificationIds(items.map((item) => item.id))}>Tout marquer lu</Button>
          </div>
          {items.slice(0, 5).map((item) => {
            const isRead = readNotificationIds.includes(item.id);
            return (
            <article className="border-b border-slate-100 py-4 last:border-b-0" key={`notif-${item.id}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 size-2 rounded-full ${isRead ? "bg-slate-300" : "bg-blue-700"}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{item.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{item.content}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-black text-blue-700">
                    <Link href={`/app/${workspaceSlug}/communication`}>Ouvrir</Link>
                    {!isRead ? <button type="button" onClick={() => setReadNotificationIds((current) => [...current, item.id])}>Marquer comme lu</button> : <span className="text-slate-400">Lu</span>}
                  </div>
                </div>
              </div>
            </article>
          );})}
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(220px,1.4fr)_150px_160px_160px_130px_120px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-black uppercase text-slate-500 md:grid">
            <span>Titre</span>
            <span>Type</span>
            <span>Audience</span>
            <span>Canaux</span>
            <span>Statut</span>
            <span>Actions</span>
          </div>
          {filteredItems.length ? filteredItems.map((item) => (
            <article className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[minmax(220px,1.4fr)_150px_160px_160px_130px_120px] md:items-center" key={item.id}>
              <div>
                <h2 className="text-base font-black">{item.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{item.content}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{item.date} - {item.id}</p>
              </div>
              <span className="text-sm font-bold text-slate-700">{item.type}</span>
              <span className="text-sm font-bold text-slate-700">{item.audience}<br /><span className="text-xs text-slate-500">{item.recipients.toLocaleString("fr-FR")} destinataires</span></span>
              <div className="flex flex-wrap gap-2">
                {item.channels.map((channel) => {
                  const Icon = channelIcon(channel);
                  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700" key={channel}><Icon className="size-3" />{channel}</span>;
                })}
              </div>
              <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-black ${statusClass(item.status)}`}>{item.status}</span>
              <Button className="min-h-9 px-3 text-xs" type="button" variant="outline" onClick={() => setDetail(item)}>
                Details
              </Button>
            </article>
          )) : (
            <div className="p-8 text-center">
              <h2 className="text-xl font-black">Aucune communication</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">Composez une annonce ou ajustez l'onglet actif.</p>
            </div>
          )}
        </section>
      )}

      {showComposer ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-4 md:place-items-center">
          <form className="max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:max-w-2xl" onSubmit={(event) => { event.preventDefault(); saveCommunication("Envoyee"); }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Composer</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setShowComposer(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Titre du message
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Assemblee generale annuelle" />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Contenu
                <textarea className="min-h-36 rounded-md border border-slate-300 px-3 py-3 text-base outline-none" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Votre message..." />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold">
                  Type
                  <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={type} onChange={(event) => setType(event.target.value as CommunicationType)}>
                    <option>Annonce</option>
                    <option>Message collectif</option>
                    <option>Notification directe</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Audience
                  <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={audience} onChange={(event) => setAudience(event.target.value)}>
                    <option>Tous les membres</option>
                    <option>Membres actifs</option>
                    <option>Bureau</option>
                    <option>Cotisations en retard</option>
                    <option>Membres selectionnes</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Programmer
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                </label>
              </div>
              <div>
                <p className="text-sm font-bold">Canaux</p>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                  {channels.map((channel) => {
                    const Icon = channelIcon(channel);
                    const disabled = channel !== "In-app";
                    return (
                      <button className={`min-h-12 rounded-md border px-2 text-xs font-black ${selectedChannels.includes(channel) ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"} ${disabled ? "opacity-75" : ""}`} type="button" key={channel} onClick={() => toggleChannel(channel)}>
                        <Icon className="mx-auto mb-1 size-4" />
                        {channel}
                        {disabled ? <span className="block text-[10px] text-amber-700">Non configure</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-950">Apercu audience</p>
                <p className="mt-1 text-2xl font-black text-blue-700">{audienceCount.toLocaleString("fr-FR")} destinataires</p>
                <p className="mt-1 text-xs font-bold text-blue-900">In-app : {audienceCount.toLocaleString("fr-FR")} {externalChannels.length ? "- Canaux externes non configures" : ""}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Button className="min-h-12" type="button" variant="outline" onClick={() => saveCommunication("Brouillon")}>Brouillon</Button>
              <Button className="min-h-12" type="button" variant="outline" onClick={() => saveCommunication("Programmee")} disabled={!scheduledAt}>
                <CalendarClock className="size-4" />
                Programmer
              </Button>
              <Button className="col-span-2 min-h-12 md:col-span-1" type="submit" disabled={!title.trim() || !content.trim() || !selectedChannels.length}>
                <Send className="size-4" />
                Envoyer
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {detail ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-4 md:place-items-center">
          <aside className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-lg">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Details</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setDetail(null)}>
                <X className="size-5" />
              </button>
            </div>
            <h3 className="text-xl font-black">{detail.title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">{detail.content}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ["Destinataires", detail.recipients],
                ["Delivres", detail.delivered],
                ["Lus", detail.read],
                ["Echecs", detail.failed],
                ["Taux lecture", readRate(detail) === null ? "N/A" : `${readRate(detail)}%`],
                ["Statut", detail.status]
              ].map(([label, value]) => (
                <div className="rounded-lg bg-slate-50 p-3" key={label as string}>
                  <p className="text-xs font-black text-slate-500">{label as string}</p>
                  <p className="mt-1 text-lg font-black">{String(value)}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
