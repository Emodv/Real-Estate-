import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseMode } from "@/lib/supabase/client";
import { isEmailAllowed } from "./allowlist";

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** True in local mode (no real auth) or when the email is allowlisted. */
  authorized: boolean;
}

/** The synthetic user used in local (no-auth) mode so ownership still works. */
const LOCAL_USER: AppUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "local@taxsale.local",
  name: "Local User",
  avatarUrl: null,
  authorized: true,
};

/**
 * Returns the current user, or null if unauthenticated.
 * - local mode: always the synthetic LOCAL_USER (no auth).
 * - supabase mode: the Supabase session user, with `authorized` reflecting the
 *   email allowlist.
 */
export async function getSessionUser(): Promise<AppUser | null> {
  if (!isSupabaseMode()) return LOCAL_USER;

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email ?? null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email,
    name: (meta.full_name as string) ?? (meta.name as string) ?? email,
    avatarUrl: (meta.avatar_url as string) ?? null,
    authorized: isEmailAllowed(email),
  };
}

/**
 * Guard for protected pages/server-components.
 * - Unauthenticated -> redirect to /login.
 * - Authenticated but not allowlisted -> redirect to /access-denied.
 * - Otherwise returns the authorized user.
 */
export async function requireAuthorizedUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.authorized) redirect("/access-denied");
  return user;
}
