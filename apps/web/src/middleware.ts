import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard"];

// Routes that are only for unauthenticated users (redirect to dashboard if signed in)
const AUTH_ROUTES = ["/sign-in", "/sign-up"];

// Better Auth cookie names (Secure contexts use the __Secure- prefix)
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

/** True when the API is on another origin — session cookies won't be on this host. */
function isCrossOriginApi(): boolean {
  const apiUrl =
    process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
  try {
    const apiHost = new URL(apiUrl).hostname;
    return apiHost !== "localhost" && apiHost !== "127.0.0.1";
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cross-origin API: cookies live on the API host; client-side useSession enforces auth
  if (isCrossOriginApi()) {
    return NextResponse.next();
  }

  const isAuthenticated = hasSessionCookie(request);

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !isAuthenticated) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
