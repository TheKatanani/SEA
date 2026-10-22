import { NextResponse, type NextRequest } from "next/server";

// Public Arabic URLs have no prefix. Internal /ar rewrites must pass through:
// removing that prefix again can turn a rewrite into a self-redirect.
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const prefixed = /^\/(ar|en)(?:\/|$)/.exec(pathname);
  const locale = prefixed?.[1] || "ar";
  const headers = new Headers(request.headers);
  headers.set("X-NEXT-INTL-LOCALE", locale);
  if (prefixed) return NextResponse.next({ request: { headers } });
  const target = request.nextUrl.clone();
  target.pathname = "/ar" + (pathname === "/" ? "" : pathname);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
