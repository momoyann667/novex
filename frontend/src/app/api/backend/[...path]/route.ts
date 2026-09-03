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
  const forwardedCookie = adminSessionId ? `sessionid=${adminSessionId}` : cookieHeader;

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (forwardedCookie) headers.set("Cookie", forwardedCookie);
  if (request.headers.get("x-workspace")) headers.set("X-Workspace", request.headers.get("x-workspace") || "");

  const csrfToken = csrfTokenFromCookie(cookieHeader);
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);

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
