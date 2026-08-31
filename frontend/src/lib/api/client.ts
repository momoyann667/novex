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
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8002/api/v1";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(errorMessageFromPayload(payload), response.status, payload?.code);
  }

  return response.json() as Promise<T>;
}
