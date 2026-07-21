import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Session refresh for Next.js middleware, per the official Supabase SSR
 * pattern. Refreshes the auth cookie on every request and returns the user so
 * middleware can enforce coarse route protection.
 *
 * No-ops (returns null user) when Supabase env vars are absent, so `local` mode
 * runs with middleware present but inert.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: { id: string; email: string | null } | null;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, user: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with the auth server. Do not
  // trust getSession() alone in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user: user ? { id: user.id, email: user.email ?? null } : null,
  };
}
