import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("sessionid", "", { expires: new Date(0), path: "/" });
  response.cookies.set("csrftoken", "", { expires: new Date(0), path: "/" });
  return response;
}
