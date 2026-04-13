import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const localeCookieName = "NEXT_LOCALE";
const defaultLocale = "en";

// BetterAuth sets this cookie name on successful sign-in.
const sessionCookieName = "better-auth.session_token";

const isAuthPage = (pathname: string): boolean =>
  pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

const isPublicPage = (pathname: string): boolean =>
  pathname.startsWith("/shared/");

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // ── Locale cookie ────────────────────────────────────────────────────────────
  const response = NextResponse.next();

  if (!request.cookies.get(localeCookieName)?.value) {
    response.cookies.set(localeCookieName, defaultLocale, {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
    });
  }

  // ── Auth guard ───────────────────────────────────────────────────────────────
  // In dev-bypass mode there is no session cookie — skip the guard entirely.
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    return response;
  }

  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (!isAuthPage(pathname) && !isPublicPage(pathname) && !hasSession) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (isAuthPage(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
