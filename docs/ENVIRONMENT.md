# Environment

Copy `.env.example` → `.env.local` and fill in values. Never commit `.env.local`.

## Variables

| Variable | Mode | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_APP_MODE` | both | `local` (default, no cloud) or `supabase`. |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase | Public anon key (safe for client; RLS protects data). |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase (server only) | Privileged server ops / tooling. **Never** expose to client. |
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

## Supabase mode

1. Create a Supabase project.
2. Apply migrations (see `docs/DATABASE.md`): `supabase db push`.
3. Enable Google in Supabase Auth → Providers; add redirect URLs.
4. Set `NEXT_PUBLIC_APP_MODE=supabase` and the Supabase URL/anon key in
   `.env.local`.
5. `npm run dev`.

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
