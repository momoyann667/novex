import { apiFetch } from "@/lib/api/client";

export type AIMessageRole = "user" | "assistant" | "system" | "tool";

export type AIMessage = {
  id: number;
  role: AIMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AIConversation = {
  id: number;
  title: string;
  module: string;
  summary: string;
  created_at: string;
  updated_at: string;
  messages: AIMessage[];
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function workspaceHeaders(workspaceSlug: string) {
  return { "X-Workspace": workspaceSlug };
}

function unwrapList<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function listAIConversations(workspaceSlug: string) {
  const payload = await apiFetch<AIConversation[] | Paginated<AIConversation>>("/ai/conversations/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function createAIConversation(workspaceSlug: string, module = "assistant") {
  return apiFetch<AIConversation>("/ai/conversations/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ module })
  });
}

export async function sendAIMessage(workspaceSlug: string, conversationId: number, content: string, module = "assistant") {
  return apiFetch<AIMessage>(`/ai/conversations/${conversationId}/messages/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ content, module })
  });
}
