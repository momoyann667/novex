"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquarePlus, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAIConversation, listAIConversations, sendAIMessage, type AIConversation, type AIMessage } from "./api";

const suggestions = [
  "Combien de membres sont actifs ?",
  "Resume les finances de l'association.",
  "Qui est en retard de cotisation ?",
  "Quels sont les prochains evenements ?",
  "Qu'avons-nous cette semaine ?",
  "Trouve les statuts de l'association."
];

function visibleMessages(conversation?: AIConversation): AIMessage[] {
  return (conversation?.messages || []).filter((message) => message.role === "user" || message.role === "assistant");
}

export function AssistantView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations", workspaceSlug],
    queryFn: () => listAIConversations(workspaceSlug)
  });
  const conversations = conversationsQuery.data || [];
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) || conversations[0],
    [conversationId, conversations]
  );
  const messages = visibleMessages(activeConversation);

  const createMutation = useMutation({
    mutationFn: () => createAIConversation(workspaceSlug),
    onSuccess: async (conversation) => {
      setConversationId(conversation.id);
      await queryClient.invalidateQueries({ queryKey: ["ai-conversations", workspaceSlug] });
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const conversation = activeConversation || await createAIConversation(workspaceSlug);
      setConversationId(conversation.id);
      return sendAIMessage(workspaceSlug, conversation.id, content);
    },
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["ai-conversations", workspaceSlug] });
    }
  });

  function submit(content = message) {
    const clean = content.trim();
    if (!clean || sendMutation.isPending) return;
    sendMutation.mutate(clean);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-blue-700">
            <Bot className="size-4" />
            Assistant IA
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">Assistant NOVEX</h1>
          <p className="mt-2 max-w-md text-sm font-semibold leading-5 text-slate-600">
            Posez une question sur vos membres, finances, cotisations, projets, evenements, documents ou rapports.
          </p>
        </div>
        <Button className="hidden min-h-11 px-4 md:inline-flex" type="button" variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <MessageSquarePlus className="size-4" />
          Nouveau
        </Button>
      </header>

      <section className="mt-5 rounded-lg border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-700">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">IA securisee et contextualisee</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/75">
              Les reponses utilisent uniquement les outils read-only autorises pour ce workspace. Aucune action sensible n'est executee sans confirmation.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Conversation</h2>
          <Button className="min-h-10 px-3 md:hidden" type="button" variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <MessageSquarePlus className="size-4" />
            Nouveau
          </Button>
        </div>

        {conversations.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {conversations.slice(0, 8).map((conversation) => (
              <button
                className={`min-h-10 shrink-0 rounded-md border px-3 text-xs font-black ${activeConversation?.id === conversation.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                key={conversation.id}
                type="button"
                onClick={() => setConversationId(conversation.id)}
              >
                {conversation.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid min-h-[360px] content-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {conversationsQuery.isLoading ? (
            <p className="text-center text-sm font-bold text-slate-500">Chargement de l'assistant...</p>
          ) : messages.length ? (
            messages.map((item) => (
              <article className={`max-w-[88%] rounded-lg px-4 py-3 text-sm font-semibold leading-6 ${item.role === "user" ? "ml-auto bg-blue-700 text-white" : "bg-slate-100 text-slate-800"}`} key={item.id}>
                {item.content}
              </article>
            ))
          ) : (
            <div className="grid gap-3 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700">
                <Bot className="size-7" />
              </span>
              <h3 className="text-xl font-black">Comment puis-je vous aider ?</h3>
              <p className="text-sm font-semibold text-slate-500">Choisissez une suggestion ou posez une question precise.</p>
            </div>
          )}
          {sendMutation.isPending ? (
            <p className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
              <Loader2 className="size-4 animate-spin" />
              Analyse des donnees NOVEX...
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((item) => (
            <button className="min-h-10 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-700" key={item} type="button" onClick={() => submit(item)}>
              {item}
            </button>
          ))}
        </div>

        {sendMutation.isError || conversationsQuery.isError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            Impossible de contacter l'assistant IA pour le moment.
          </p>
        ) : null}

        <form className="sticky bottom-20 grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:bottom-0" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <input
            className="min-h-12 min-w-0 rounded-md bg-slate-50 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Ex: Resume les depenses du mois..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button className="min-h-12 px-4" type="submit" disabled={sendMutation.isPending || !message.trim()} aria-label="Envoyer">
            <Send className="size-5" />
          </Button>
        </form>
      </section>
    </main>
  );
}
