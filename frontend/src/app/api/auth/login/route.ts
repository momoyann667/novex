import { NextResponse } from "next/server";
import { backendApiBaseUrl, backendUnavailableMessage } from "@/lib/api/server";

const apiBaseUrl = backendApiBaseUrl();

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
  } catch (error) {
    return NextResponse.json(
      {
        message: backendUnavailableMessage(error)
      },
      { status: 503 }
    );
  }
}
