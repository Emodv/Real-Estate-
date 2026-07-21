# Security

This is a **private internal application**. Design goals: only authorized
users reach any data, and no secret ever lands in the repository or the client
bundle.

## Authentication (supabase mode)

- **Google OAuth** via Supabase Auth. Configure in the Supabase dashboard →
  Authentication → Providers → Google. The Google client ID/secret live in
  Supabase, **never** in this repo.
- Add your authorized redirect URL: `https://<your-app>/auth/callback` (and
  `http://localhost:3000/auth/callback` for local dev).
- Private routes: server components call `createSupabaseServerClient()` and
  redirect unauthenticated users to sign-in. (Wiring the sign-in route is the
  first task when switching to supabase mode — the client factory and RLS are
  already in place.)

## Authorization

- **Row Level Security** is enabled on every table (`0002_rls_policies.sql`).
- A user can read/write only rows they own; child rows inherit ownership by
  join to `properties`. Even a leaked anon key cannot read another user's data.

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
