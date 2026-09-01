import { NextRequest, NextResponse } from "next/server";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export function middleware(request: NextRequest) {
  const workspaceSlug = request.nextUrl.pathname.split("/")[2];

  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("reason", "invalid_workspace");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:workspace/:path*"],
};
