# Roadmap

Built in vertical slices. **Do not build a later phase until the previous one
is working, tested, and validated.**

## Phase 0 — Inspection & Architecture ✅
Repository inspected (greenfield). Documentation set authored. Data model,
engine design, and security posture defined.

## Phase 1 — Manual Underwriting MVP ✅ (this release)
- Deterministic underwriting engine (pure, 38 unit tests).
- Property intake form + Zod validation.
- Property detail page: bid strategy, six ceilings, Show-Your-Math, BRRRR,
  cash flow, refinance, deal killers, SWOT, investment score, confidence,
  evidence, investment committee, verdict.
- Local JSON-file persistence (save & reopen). Supabase schema + RLS authored.
- `local` mode runs with zero cloud setup.

**Not yet wired (documented, ready to switch on):** Supabase-backed store and
Google OAuth sign-in route. The factories, migrations, and RLS are in place.

## Phase 2 — Historical Backtesting
Historical import, model-at-time-of-sale mode, actual-result comparison,
opportunity-identification accuracy. Hindsight-bias controls. Test ≥10
historical properties (including "looked cheap but were bad"). See
`docs/BACKTESTING.md`.

## Phase 3 — Market Intelligence
Authorized sources (Maps/Places, municipal GIS, public listings where
permitted). Comparable search + ranking, distance & time adjustment,
similarity scoring, rental comps. Every comparable carries source, date,
distance, similarity, and reason selected/rejected.

## Phase 4 — AI Research Copilot
Provider abstraction (Anthropic / Gemini / OpenAI), task routing, structured
outputs validated by Zod. **AI never performs financial math** and never
becomes the final authority — it supplies inputs and narrative only.

## Phase 5 — Automated Property Discovery
Authorized ingestion pipeline: source → ingest → normalize → dedupe → enrich →
underwrite → score → rank → human review. **Never bids automatically.**

## Phase 6 — Opportunity Ranking
"Best Deals Right Now" with filters and curated boards (Top Value, Top BRRRR,
Top Cash Flow, Lowest Risk, Best Waterfront/Land/Houses, Hidden Gems).

## Phase 7 — Alerts
Telegram / email notifications for new high-quality opportunities — only after
the core is validated.
