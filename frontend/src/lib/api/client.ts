export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessageFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Une erreur est survenue.";
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") {
    return data.message;
  }
  if (typeof data.detail === "string") {
    return data.detail;
  }

  const firstError = Object.entries(data).find(([, value]) => Array.isArray(value) || typeof value === "string");
  if (!firstError) {
    return "Une erreur est survenue.";
  }

  const [field, value] = firstError;
  const message = Array.isArray(value) ? value.join(" ") : value;
  return `${field}: ${message}`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/backend";
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers
    });
  } catch {
    throw new ApiError("Backend indisponible. Lance Django sur le port 8002 puis reessaie.", 503);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(errorMessageFromPayload(payload), response.status, payload?.code);
  }

  return response.json() as Promise<T>;
}
