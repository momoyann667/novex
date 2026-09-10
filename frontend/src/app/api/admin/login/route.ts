import { NextResponse } from "next/server";
import { backendApiBaseUrl, backendUnavailableMessage } from "@/lib/api/server";

const apiBaseUrl = backendApiBaseUrl();

function sessionIdFromSetCookie(setCookie: string | null) {
  return setCookie?.match(/(?:^|,\s*)sessionid=([^;]+)/)?.[1] || "";
}

function csrfToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(32);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const response = await fetch(`${apiBaseUrl}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const sessionId = sessionIdFromSetCookie(response.headers.get("set-cookie"));

    if (response.ok && sessionId) {
      nextResponse.cookies.set("novex_admin_sessionid", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      nextResponse.cookies.set("novex_admin_csrftoken", csrfToken(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json({ message: backendUnavailableMessage(error) }, { status: 503 });
  }
}
