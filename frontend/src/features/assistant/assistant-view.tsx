"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Bot, Loader2, MessageSquarePlus, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAIConversation, listAIConversations, sendAIMessage, type AIConversation, type AIMessage } from "./api";

const suggestions = [
  "Analyse les depenses",
  "Membres en retard",
  "Quels sont les prochains evenements ?",
  "Qu'avons-nous cette semaine ?",
  "Resume les finances",
  "Trouve les statuts"
];

function visibleMessages(conversation?: AIConversation): AIMessage[] {
  return (conversation?.messages || []).filter((message) => message.role === "user" || message.role === "assistant");
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function toolDataFor(message: AIMessage, conversation?: AIConversation) {
  if (!conversation || message.role !== "assistant") return null;
  const messageIndex = conversation.messages.findIndex((item) => item.id === message.id);
  const previousTools = conversation.messages.slice(0, messageIndex).filter((item) => item.role === "tool");
  return previousTools.at(-1)?.metadata?.data as Record<string, unknown> | undefined;
}

function AssistantBubble({ item, conversation }: Readonly<{ item: AIMessage; conversation?: AIConversation }>) {
  const isUser = item.role === "user";
  const toolData = toolDataFor(item, conversation);
  const income = Number(toolData?.income || 0);
  const expense = toolData?.expense;
  const balance = Number(toolData?.balance || 0);
  const showFinanceCard = !isUser && expense !== undefined;
  const chartValues = [income, Number(expense || 0), Math.max(balance, 0)];
  const maxChartValue = Math.max(...chartValues, 1);

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-[#0f7ff2] text-white shadow-sm">
          <Bot className="size-4" />
        </span>
      ) : null}
      <article className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] font-semibold leading-5 shadow-sm ${isUser ? "rounded-br-sm bg-[#0863cf] text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"}`}>
        <p className="whitespace-pre-line">{item.content}</p>
        {showFinanceCard ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 text-slate-950">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-normal text-slate-500">Total depenses</span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">Donnees NOVEX</span>
            </div>
            <strong className="text-2xl font-black tracking-normal">{formatMoney(expense)}</strong>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] font-black text-slate-500">Synthese financiere</p>
              <div className="mt-8 flex h-12 items-end justify-around gap-2">
                {chartValues.map((value, index) => {
                  const height = Math.max(8, Math.round((value / maxChartValue) * 48));
                  return (
                  <span className="w-8 rounded-t bg-blue-100" style={{ height }} key={index} />
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-3 text-center text-[10px] font-black text-slate-600">
                <span>Rec.</span>
                <span>Dep.</span>
                <span>Solde</span>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
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
    <main className="min-h-screen bg-[#f6f8fb] pb-24 text-slate-950 md:rounded-[28px]">
      <header className="sticky top-0 z-10 grid min-h-14 grid-cols-[44px_1fr_44px] items-center border-b border-slate-200 bg-[#f8fafc]/95 px-3 backdrop-blur">
        <button className="grid size-9 place-items-center rounded-full text-slate-700" type="button" aria-label="Menu">
          <img className="size-6 rounded-md object-cover" src="/brand/novex-favicon.jpg" alt="NOVEX" />
        </button>
        <img className="mx-auto h-8 w-24 object-contain" src="/brand/novex-logo.jpg" alt="NOVEX" />
        <button className="grid size-9 place-items-center rounded-full text-slate-700" type="button" aria-label="Notifications">
          <Bell className="size-4" />
        </button>
      </header>

      <section className="mx-auto grid max-w-md gap-4 px-3 py-4 md:max-w-2xl">
        <div className="flex justify-end">
          <Button className="min-h-9 rounded-full px-3 text-xs" type="button" variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <MessageSquarePlus className="size-4" />
            Nouveau
          </Button>
        </div>

        <div className="grid min-h-[calc(100vh-230px)] content-start gap-4">
          {conversationsQuery.isLoading ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 shadow-sm">Chargement de l'assistant...</p>
          ) : messages.length ? (
            messages.map((item) => <AssistantBubble item={item} conversation={activeConversation} key={item.id} />)
          ) : (
            <div className="flex items-start gap-2">
              <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-[#0f7ff2] text-white shadow-sm">
                <Bot className="size-4" />
              </span>
              <div className="max-w-[82%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold leading-5 text-slate-800 shadow-sm">
                Bonjour, je suis l'assistant NOVEX. Comment puis-je vous aider aujourd'hui ?
              </div>
            </div>
          )}
          {sendMutation.isPending ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
              <Loader2 className="size-4 animate-spin" />
              Analyse des donnees...
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((item) => (
            <button className="min-h-8 shrink-0 rounded-full border border-blue-100 bg-white px-3 text-[11px] font-black text-blue-700 shadow-sm" key={item} type="button" onClick={() => submit(item)}>
              {item}
            </button>
          ))}
        </div>

        {sendMutation.isError || conversationsQuery.isError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            Impossible de contacter l'assistant IA pour le moment.
          </p>
        ) : null}
      </section>

      <form className="fixed inset-x-0 bottom-20 z-20 mx-auto grid max-w-md grid-cols-[34px_minmax(0,1fr)_42px] items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur md:bottom-0 md:max-w-2xl md:rounded-t-2xl md:border md:border-slate-200" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <button className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500" type="button" aria-label="Joindre un fichier">
          <Paperclip className="size-4" />
        </button>
        <input
          className="min-h-10 min-w-0 rounded-full bg-slate-100 px-4 text-sm font-semibold outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Posez une question..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button className="grid size-10 place-items-center rounded-full bg-[#0863cf] p-0 text-white" type="submit" disabled={sendMutation.isPending || !message.trim()} aria-label="Envoyer">
          <Send className="size-5" />
        </Button>
      </form>
    </main>
  );
}
