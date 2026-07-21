/**
 * Email allowlist — the Phase 1.5 access-control model.
 *
 * Access is restricted to a comma-separated `ALLOWED_EMAILS` env var. This is
 * deliberately simple and is designed to be swapped for a database-backed
 * `user_roles` table later WITHOUT changing call sites: everything goes through
 * `isEmailAllowed()` / `getAllowedEmails()`.
 *
 * Server-only value: `ALLOWED_EMAILS` is NOT prefixed with NEXT_PUBLIC, so it
 * never reaches the browser bundle.
 */
export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = getAllowedEmails();
  // If no allowlist is configured, deny by default in supabase mode. This is a
  // private tool — fail closed, never open.
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}
