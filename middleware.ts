import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection + session refresh.
 *
 * - `local` mode (no Supabase env): inert — the app is single-user and
 *   unauthenticated by design for local evaluation.
 * - `supabase` mode: refreshes the session and redirects unauthenticated
 *   users away from protected routes to /login. Fine-grained allowlist
 *   enforcement happens at the page level via `requireAuthorizedUser()`.
 */
const PUBLIC_PATHS = ["/login", "/auth", "/access-denied"];

export async function middleware(request: NextRequest) {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Local mode: do nothing.
  if (!supabaseConfigured) return NextResponse.next();

  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Protect everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
