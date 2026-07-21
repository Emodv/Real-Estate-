# TaxSale Copilot

Private, internal investment-intelligence tool for identifying, underwriting,
and bidding on **Ontario municipal tax-sale properties** using a
**BUY → RENOVATE → RENT → REFINANCE → REPEAT (BRRRR)** strategy.

It answers one question conservatively:

> *"At what purchase price does this property stop being a good investment for
> my specific BRRRR strategy?"*

The system prefers **NO DEAL over a BAD DEAL**. It never optimizes for the
biggest discount or the flashiest ROI, and it **never bids automatically** — it
recommends; the human decides.

---

## What it does (Phase 1, this release)

Enter one real Ontario tax-sale property manually and get:

- Conservative market value, ARV, renovation, rental, and refinance modeling
- A full **BRRRR** analysis (project cost, cash invested, capital recovered /
  trapped, cash flow, cap rate, DSCR, cash-on-cash, equity created)
- **Six independent bid ceilings** (Value, BRRRR, Cash-Flow, ROI,
  Risk-Adjusted, Capital) and the **binding constraint**
- Conservative / Target / **Maximum Safe Bid** / Hard Stop
- **Show Your Math** — every subtraction is inspectable
- **Deal Killers** & risk classification (an UNKNOWN is treated as risky)
- **SWOT** with evidence on every statement
- Transparent **investment score** (sub-scores) and **confidence** (derived
  from evidence, not invented)
- **Investment Committee** summary and a gated **verdict**
- Save the run and reopen it later

### Golden rules baked into the engine

1. **Never trust assessed value alone** — value is evidence-based, with ranges
   and confidence.
2. **AI never does the financial math** — all figures come from pure,
   deterministic, unit-tested TypeScript. (AI is a later phase and is limited
   to inputs/narrative, always Zod-validated.)
3. **Every number is reproducible** and **every conclusion is traceable** to
   its evidence.

---

## Quick start (zero cloud setup)

```bash
npm install
npm run dev      # http://localhost:3000
```

Runs in **local mode** (`NEXT_PUBLIC_APP_MODE=local`) with no auth and a JSON
file store, seeded with one **illustrative** sample property. Click into it to
see the full underwriting report, or **New property → Load sample data** to
try the intake form.

### Verify the build

```bash
npm test         # 38 unit tests (engine correctness, no-NaN, determinism)
npm run typecheck
npm run lint
npm run build
```

All four pass in this release.

---

## Tech stack

Next.js (App Router) · TypeScript · Tailwind · Zod · Supabase (Postgres + Auth
+ RLS) · Vitest. A modular monolith — no Redis/queues/microservices.

## Documentation

| Doc | |
|-----|--|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, boundaries, app modes |
| [`docs/UNDERWRITING_ENGINE.md`](docs/UNDERWRITING_ENGINE.md) | The deterministic core, ceilings, verdict gating |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Supabase schema, migrations, the `PropertyStore` seam |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Provenance, raw-vs-derived, reproducibility |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth, RLS, secrets, safe sourcing |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Env vars & scripts |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased plan |
| [`docs/BACKTESTING.md`](docs/BACKTESTING.md) | Hindsight-free backtesting design |

---

## Going to full mode (Supabase + Google auth)

The Supabase migrations (`supabase/migrations/`), RLS policies, and client
factories are all in place. See `docs/DATABASE.md` and `docs/SECURITY.md` to
apply migrations, enable Google OAuth, and set `NEXT_PUBLIC_APP_MODE=supabase`.

## Scope & safety

No scraping, paywall/CAPTCHA bypass, automated bidding, billing, or
multi-tenancy. Data is entered manually in Phase 1. All figures are estimates
unless marked `VERIFIED`. Nothing in the seeded sample is real market data.
