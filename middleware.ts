import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/(en|ru)\/family(\/|$)/.test(pathname)) {
    const lang = pathname.startsWith("/ru") ? "ru" : "en";
    return NextResponse.redirect(new URL(`/${lang}`, request.url));
  }
}

export const config = {
  matcher: ["/(en|ru)/family/:path*", "/(en|ru)/family"],
};
