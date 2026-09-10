import { NextResponse } from "next/server";
import { backendApiBaseUrl, backendUnavailableMessage } from "@/lib/api/server";

const apiBaseUrl = backendApiBaseUrl();

type RouteContext = {
  params: Promise<{ path: string[] }> | { path: string[] };
};

async function resolvePath(context: RouteContext) {
  const params = await context.params;
  return params.path.join("/");
}

function csrfTokenFromCookie(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="))
    ?.slice("csrftoken=".length);
}

function csrfToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(32);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

function cookieValue(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function proxy(request: Request, context: RouteContext) {
  const path = await resolvePath(context);
  const url = new URL(request.url);
  const targetUrl = `${apiBaseUrl}/${path}/${url.search}`;
  const cookieHeader = request.headers.get("cookie") || "";
  const headers = new Headers();
  const adminSessionId = path.startsWith("admin/") ? cookieValue(cookieHeader, "novex_admin_sessionid") : "";
  const adminCsrfToken = path.startsWith("admin/") ? cookieValue(cookieHeader, "novex_admin_csrftoken") : "";
  const csrf = adminCsrfToken || (adminSessionId ? csrfToken() : csrfTokenFromCookie(cookieHeader));
  const forwardedCookie = adminSessionId ? [`sessionid=${adminSessionId}`, csrf ? `csrftoken=${csrf}` : ""].filter(Boolean).join("; ") : cookieHeader;

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (forwardedCookie) headers.set("Cookie", forwardedCookie);
  if (request.headers.get("x-workspace")) headers.set("X-Workspace", request.headers.get("x-workspace") || "");

  if (csrf) headers.set("X-CSRFToken", csrf);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store"
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
    const nextResponse = contentType.includes("application/json")
      ? NextResponse.json(payload, { status: response.status })
      : new NextResponse(payload, { status: response.status });
    const setCookie = response.headers.get("set-cookie");
    const contentDisposition = response.headers.get("content-disposition");

    if (setCookie) {
      nextResponse.headers.set("set-cookie", setCookie);
    }
    if (adminSessionId && csrf && !adminCsrfToken) {
      nextResponse.cookies.set("novex_admin_csrftoken", csrf, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    if (contentType) {
      nextResponse.headers.set("content-type", contentType);
    }
    if (contentDisposition) {
      nextResponse.headers.set("content-disposition", contentDisposition);
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      {
        message: backendUnavailableMessage(error)
      },
      { status: 503 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxy(request, context);
}
