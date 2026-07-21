# Environment

Copy `.env.example` → `.env.local` and fill in values. Never commit `.env.local`.

## Variables

| Variable | Mode | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_APP_MODE` | both | `local` (default, no cloud) or `supabase`. |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase | Public anon key (safe for client; RLS protects data). |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase (server only) | Privileged server ops / tooling. **Never** expose to client. |
| `ALLOWED_EMAILS` | supabase (server only) | Comma-separated authorized emails. Empty = deny everyone (fail closed). |
| `GOOGLE_MAPS_API_KEY` | optional (server only) | Geocoding for the subject + comparables so the engine derives real distances. Falls back to manual lat/lng when absent. |
| `ANTHROPIC_API_KEY` | Phase 4+ | Server-only. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Phase 4+ | Server-only. |
| `OPENAI_API_KEY` | Phase 4+ | Server-only. |

Google OAuth client ID/secret are configured **inside Supabase**, not here.

## Local mode (default — zero setup)

```bash
npm install
npm run dev          # http://localhost:3000  (seeded with one sample property)
```

Data is stored in `.data/properties.json` (gitignored).

## Supabase mode (auth + persistence)

1. **Create a Supabase project.**
2. **Apply migrations** (see `docs/DATABASE.md`): `supabase db push`
   (applies `0001` → `0002` → `0003`).
3. **Configure Google OAuth (two consoles):**
   - *Google Cloud console*: create/confirm an OAuth 2.0 Web client. Set the
     **Authorized redirect URI** to your Supabase callback:
     `https://<project-ref>.supabase.co/auth/v1/callback`.
   - *Supabase dashboard* → Authentication → Providers → **Google**: paste the
     Google **client ID** and **client secret**. (These live in Supabase, not
     in this repo.)
   - *Supabase dashboard* → Authentication → URL Configuration: add your app's
     **Site URL** and redirect URLs, including
     `http://localhost:3000/auth/callback` and your deployed
     `https://<your-app>/auth/callback`.
4. **Set env** in `.env.local`:
   ```
   NEXT_PUBLIC_APP_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ALLOWED_EMAILS=you@example.com
   GOOGLE_MAPS_API_KEY=...        # optional
   ```
5. `npm run dev`, visit `/login`, sign in with an allowlisted Google account.

## Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Dev server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm test` | Vitest unit tests. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint (next lint). |

## Remote / web sessions

The container is ephemeral: commit and push anything worth keeping. Chromium is
pre-installed for any future Playwright use — do not run `playwright install`.
