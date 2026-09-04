export function backendMediaUrl(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8002/api/v1";
  const backendOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, "");
  return `${backendOrigin}${value.startsWith("/") ? value : `/${value}`}`;
}
