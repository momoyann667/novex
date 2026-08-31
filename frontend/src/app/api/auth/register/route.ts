import { NextResponse } from "next/server";

const apiBaseUrl = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8002/api/v1";

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const response = await fetch(`${apiBaseUrl}/auth/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as unknown;
      return NextResponse.json(payload, { status: response.status });
    }

    const text = await response.text();
    return NextResponse.json({ message: text || "Une erreur est survenue." }, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        message: "Backend indisponible. Lance le serveur Django sur le port 8002 puis reessaie."
      },
      { status: 503 }
    );
  }
}
