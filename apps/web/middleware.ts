import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const localeCookieName = "NEXT_LOCALE";
const defaultLocale = "en";

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  if (!request.cookies.get(localeCookieName)?.value) {
    response.cookies.set(localeCookieName, defaultLocale, {
      httpOnly: false,
      path: "/",
      sameSite: "lax"
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};