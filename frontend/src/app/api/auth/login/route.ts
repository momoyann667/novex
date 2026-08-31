import { NextResponse } from "next/server";

const apiBaseUrl = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8002/api/v1";

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const response = await fetch(`${apiBaseUrl}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : { message: await response.text() };
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      nextResponse.headers.set("set-cookie", setCookie);
    }

    return nextResponse;
  } catch {
    return NextResponse.json(
      {
        message: "Backend indisponible. Lance le serveur Django sur le port 8002 puis reessaie."
      },
      { status: 503 }
    );
  }
}
