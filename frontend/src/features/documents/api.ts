import { apiFetch, ApiError } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type DocumentCategory =
  | "administrative"
  | "financial"
  | "members"
  | "contributions"
  | "project"
  | "event"
  | "legal"
  | "report"
  | "communication"
  | "other";

export type DocumentStatus = "draft" | "pending" | "active" | "approved" | "rejected" | "archived" | "trash";
export type DocumentVisibility = "private" | "members" | "team" | "workspace" | "shared";
export type DocumentSensitivity = "normal" | "sensitive";

export type DocumentFolder = {
  id: number;
  name: string;
  description: string;
  parent: number | null;
  color: string;
  icon: string;
  is_archived: boolean;
  breadcrumb: Array<{ id: number; name: string }>;
  created_at: string;
  updated_at: string;
};

export type DocumentResource = {
  id: number;
  name: string;
  description: string;
  file: string;
  file_type: string;
  mime_type: string;
  size: number;
  checksum: string;
  original_filename: string;
  category: DocumentCategory;
  folder: number | null;
  folder_name: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  sensitivity: DocumentSensitivity;
  tag_names: string[];
  project: number | null;
  project_name: string;
  event: number | null;
  event_name: string;
  financial_transaction: number | null;
  payment: number | null;
  member: number | null;
  member_name: string;
  current_version: number;
  metadata: Record<string, unknown>;
  retention_until: string | null;
  uploaded_by: number | null;
  is_favorite: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentVersion = {
  id: number;
  version_number: number;
  file: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  size: number;
  checksum: string;
  change_note: string;
  uploaded_by: number | null;
  restored_from: number | null;
  created_at: string;
};

export type DocumentActivity = {
  id: number;
  action: string;
  actor: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DocumentAnalytics = {
  total_documents: number;
  active_documents: number;
  recent_documents: number;
  shared_documents: number;
  archived_documents: number;
  pending_documents: number;
  favorite_documents: number;
  sensitive_documents: number;
  total_size: number;
  storage_usage: {
    used: number;
    available: number;
    quota: number;
    percentage: number;
  };
  documents_by_category: Array<{ category: DocumentCategory; count: number; size: number | null }>;
  documents_by_type: Array<{ file_type: string; count: number; size: number | null }>;
  recent_items: Array<{ id: number; name: string; file_type: string; category: DocumentCategory; status: DocumentStatus; updated_at: string }>;
  approval_items: number;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type DocumentFilters = {
  search?: string;
  category?: string;
  status?: string;
  visibility?: string;
  folder?: string;
  view?: string;
  ordering?: string;
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }

  return { "X-Workspace": workspaceSlug };
}

function unwrapList<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export async function listDocuments(workspaceSlug: string, filters: DocumentFilters = {}) {
  const payload = await apiFetch<DocumentResource[] | Paginated<DocumentResource>>(
    `/documents/${buildQuery({
      search: filters.search,
      category: filters.category,
      status: filters.status,
      visibility: filters.visibility,
      folder: filters.folder,
      view: filters.view,
      ordering: filters.ordering || "-updated_at"
    })}`,
    { headers: workspaceHeaders(workspaceSlug), cache: "no-store" }
  );
  return unwrapList(payload);
}

export async function listFolders(workspaceSlug: string) {
  const payload = await apiFetch<DocumentFolder[] | Paginated<DocumentFolder>>("/documents/folders/?ordering=name", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function createFolder(workspaceSlug: string, name: string) {
  return apiFetch<DocumentFolder>("/documents/folders/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ name })
  });
}

export async function getDocumentAnalytics(workspaceSlug: string) {
  return apiFetch<DocumentAnalytics>("/documents/analytics/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getDocument(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentResource>(`/documents/${documentId}/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getDocumentVersions(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentVersion[]>(`/documents/${documentId}/versions/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getDocumentActivity(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentActivity[]>(`/documents/${documentId}/activity/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function uploadDocument(
  workspaceSlug: string,
  payload: {
    file: File;
    name?: string;
    category: string;
    folder?: string;
    visibility: string;
    sensitivity: string;
  }
) {
  const body = new FormData();
  body.append("file", payload.file);
  body.append("name", payload.name || payload.file.name);
  body.append("category", payload.category);
  body.append("visibility", payload.visibility);
  body.append("sensitivity", payload.sensitivity);
  if (payload.folder) body.append("folder", payload.folder);

  return apiFetch<DocumentResource>("/documents/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body
  });
}

export async function patchDocument(workspaceSlug: string, documentId: string, payload: Partial<DocumentResource>) {
  return apiFetch<DocumentResource>(`/documents/${documentId}/`, {
    method: "PATCH",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export async function archiveDocument(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentResource>(`/documents/${documentId}/archive/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export async function trashDocument(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentResource>(`/documents/${documentId}/`, {
    method: "DELETE",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export async function restoreDocument(workspaceSlug: string, documentId: string) {
  return apiFetch<DocumentResource>(`/documents/${documentId}/restore/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export async function restoreDocumentVersion(workspaceSlug: string, documentId: string, versionId: number) {
  return apiFetch<DocumentVersion>(`/documents/${documentId}/versions/${versionId}/restore/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export async function downloadDocument(workspaceSlug: string, documentId: string, filename: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/backend";
  const response = await fetch(`${baseUrl}/documents/${documentId}/download/`, {
    credentials: "include",
    headers: workspaceHeaders(workspaceSlug)
  });

  if (!response.ok) {
    throw new ApiError("Telechargement impossible.", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportDocuments(workspaceSlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/backend";
  const response = await fetch(`${baseUrl}/documents/export/`, {
    credentials: "include",
    headers: workspaceHeaders(workspaceSlug)
  });

  if (!response.ok) {
    throw new ApiError("Export impossible.", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "documents.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
