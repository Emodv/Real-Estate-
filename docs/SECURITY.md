# Security

This is a **private internal application**. Design goals: only authorized
users reach any data, and no secret ever lands in the repository or the client
bundle.

## Authentication (supabase mode) — implemented (Phase 1.5)

- **Google OAuth** via Supabase Auth (official `@supabase/ssr` App Router
  pattern). Configure the provider in the Supabase dashboard →
  Authentication → Providers → Google. The Google client ID/secret live in
  **Supabase, never in this repo** and are never read by the app.
- Authorized redirect URL: `https://<your-app>/auth/callback` (and
  `http://localhost:3000/auth/callback` for local dev).
- Flow: `/login` (`GoogleSignIn` → `signInWithOAuth`) →
  `/auth/callback` (`exchangeCodeForSession`) → `/dashboard`.
  Sign out: `POST /auth/signout`.
- **Session refresh + route protection** run in `middleware.ts`
  (`updateSession`): unauthenticated users hitting any non-public route are
  redirected to `/login?next=…`.
- **Page-level guard**: every protected server component calls
  `requireAuthorizedUser()` — a belt-and-suspenders check on top of middleware.

## Authorization — email allowlist + RLS

- **Allowlist** (`ALLOWED_EMAILS`, server-only): an authenticated Google
  account not on the list is sent to `/access-denied` (with a sign-out button).
  **Fail closed** — an empty allowlist denies everyone. Everything routes
  through `isEmailAllowed()` so it can later become a DB `user_roles` table
  without touching call sites.
- **Row Level Security** on every table (`0002_rls_policies.sql`,
  tightened in `0003_ownership_and_sources.sql`). A user can read/write only
  rows where `owner_id = auth.uid()` OR `created_by = auth.uid()`; anonymous
  access (`auth.uid()` null) is always denied. `underwriting_runs` additionally
  carry a *restrictive* policy requiring the parent property to be owned by the
  caller. Even a leaked anon key cannot read another user's data.
- **Local mode** (`NEXT_PUBLIC_APP_MODE` unset/`local`): middleware is inert
  and a synthetic authorized user is used — **no authentication**. For a
  trusted single-user machine only; never expose it publicly.

## Secrets

- All secrets live in environment variables. See `.env.example`.
- **Never commit** `.env`, `.env.local`, API keys, the Supabase service-role
  key, or OAuth secrets. `.gitignore` blocks the env files.
- The **service-role key** is server-only and is never referenced by client
  code or the server component Supabase factory (which uses the user session).
- AI provider keys (Phase 4+) are server-only and never exposed to the browser.

## Local mode caveat

`NEXT_PUBLIC_APP_MODE=local` runs **without authentication** and stores data in
a local JSON file. It is for single-user evaluation on a trusted machine only.
Do **not** expose a local-mode instance to the public internet.

## Safe data-sourcing posture

The system does **not** scrape aggressively, bypass authentication, paywalls,
or CAPTCHAs, or violate site terms. Tax-sale data is entered manually or
imported from user-provided documents in Phase 1; authorized ingestion comes
later (see `docs/ROADMAP.md`). The system **never bids automatically** — it
recommends; the human decides.
