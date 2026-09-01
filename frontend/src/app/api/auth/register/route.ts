import { NextResponse } from "next/server";
import { backendApiBaseUrl, backendUnavailableMessage } from "@/lib/api/server";

const apiBaseUrl = backendApiBaseUrl();

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
  } catch (error) {
    return NextResponse.json(
      {
        message: backendUnavailableMessage(error)
      },
      { status: 503 }
    );
  }
}
