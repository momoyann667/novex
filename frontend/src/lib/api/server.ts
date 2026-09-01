export function backendApiBaseUrl() {
  return process.env.BACKEND_API_BASE_URL || "http://127.0.0.1:8002/api/v1";
}

export function backendUnavailableMessage(error?: unknown) {
  const detail = error instanceof Error && error.message ? ` Detail: ${error.message}` : "";
  return `Backend indisponible. Verifie que Django tourne sur http://127.0.0.1:8002.${detail}`;
}
