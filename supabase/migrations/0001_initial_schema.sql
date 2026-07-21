-- =====================================================================
-- TaxSale Copilot — Initial schema
-- =====================================================================
-- Design principles:
--   * UUID primary keys, created_at/updated_at timestamps everywhere.
--   * Raw source data (property_sources) is stored SEPARATELY from derived
--     analysis (market_valuations, underwriting_runs, ...). Source data is
--     never overwritten by AI interpretations.
--   * Row Level Security is ON for every table. This is an internal tool: a
--     signed-in user sees only the rows they own.
--   * No secrets are ever stored in the database.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Reusable updated_at trigger -----------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- users (mirror of auth.users for app-level joins / ownership)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- properties (identity)
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  address text,
  municipality text,
  county text,
  legal_description text,
  roll_number text,
  pin text,
  property_type text,
  waterfront boolean default false,
  rural boolean default false,
  lot_size_acres numeric,
  bedrooms int,
  bathrooms numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_properties_owner on public.properties(owner_id);

-- ---------------------------------------------------------------------
-- tax_sale_events
-- ---------------------------------------------------------------------
create table if not exists public.tax_sale_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sale_date date,
  minimum_tender numeric,
  tax_arrears numeric,
  tender_deadline timestamptz,
  status text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tax_sale_property on public.tax_sale_events(property_id);

-- ---------------------------------------------------------------------
-- property_sources (RAW provenance — never overwritten by analysis)
-- ---------------------------------------------------------------------
create table if not exists public.property_sources (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_name text not null,
  source_type text,
  source_url text,
  retrieved_at timestamptz not null default now(),
  raw_content text,            -- only where legally permitted
  extracted_fields jsonb,
  extraction_method text,
  confidence int,
  created_at timestamptz not null default now()
);
create index if not exists idx_sources_property on public.property_sources(property_id);

-- ---------------------------------------------------------------------
-- property_documents / property_images
-- ---------------------------------------------------------------------
create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text,                   -- infopak | title-search | inspection | other
  storage_path text,           -- Supabase Storage path
  label text,
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_property on public.property_documents(property_id);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists idx_images_property on public.property_images(property_id);

-- ---------------------------------------------------------------------
-- comparable_properties / comparable_sales / rental_comparables
-- ---------------------------------------------------------------------
create table if not exists public.comparable_sales (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  address text,
  sale_price numeric,
  sale_date date,
  distance_km numeric,
  similarity_score numeric,
  reason_selected text,
  reason_rejected text,
  source_url text,
  data_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_comp_sales_property on public.comparable_sales(property_id);

create table if not exists public.rental_comparables (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  address text,
  monthly_rent numeric,
  listed_date date,
  distance_km numeric,
  similarity_score numeric,
  source_url text,
  data_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_rental_comps_property on public.rental_comparables(property_id);

-- ---------------------------------------------------------------------
-- Derived analysis: valuations / estimates / risk
-- ---------------------------------------------------------------------
create table if not exists public.market_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  conservative_as_is numeric,
  base_value numeric,
  optimistic_value numeric,
  arv numeric,
  confidence int,
  evidence jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_valuations_property on public.market_valuations(property_id);

create table if not exists public.renovation_estimates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  cosmetic numeric,
  major numeric,
  structural numeric,
  contingency_pct numeric,
  confidence int,
  created_at timestamptz not null default now()
);

create table if not exists public.rental_estimates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  monthly_rent numeric,
  vacancy_pct numeric,
  operating_expenses jsonb,
  confidence int,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text,
  severity text,             -- FATAL | HIGH | MEDIUM | LOW | UNKNOWN
  label text,
  detail text,
  data_status text,
  fatal_if_confirmed boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_risks_property on public.risk_assessments(property_id);

-- ---------------------------------------------------------------------
-- underwriting_runs (stores the exact input + snapshot of the result)
-- ---------------------------------------------------------------------
create table if not exists public.underwriting_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  input jsonb not null,        -- full UnderwritingInput (reproducible)
  result jsonb,                -- snapshot of the deterministic result
  engine_version text,
  verdict text,
  maximum_safe_bid numeric,
  binding_constraint text,
  investment_score int,
  overall_confidence int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_runs_property on public.underwriting_runs(property_id);
create index if not exists idx_runs_owner on public.underwriting_runs(owner_id);

create table if not exists public.bid_scenarios (
  id uuid primary key default gen_random_uuid(),
  underwriting_run_id uuid not null references public.underwriting_runs(id) on delete cascade,
  ceiling_key text,            -- VALUE | BRRRR | CASH_FLOW | ROI | RISK_ADJUSTED | CAPITAL
  amount numeric,
  is_binding boolean default false,
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists idx_scenarios_run on public.bid_scenarios(underwriting_run_id);

-- ---------------------------------------------------------------------
-- evidence_items (provenance for any conclusion)
-- ---------------------------------------------------------------------
create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  claim text not null,
  value text,
  source text,
  source_type text,
  as_of date,
  distance_km numeric,
  data_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_evidence_property on public.evidence_items(property_id);

-- ---------------------------------------------------------------------
-- backtest_records (Phase 2)
-- ---------------------------------------------------------------------
create table if not exists public.backtest_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  owner_id uuid not null references public.users(id) on delete cascade,
  as_of_date date,             -- information cutoff (prevents hindsight bias)
  input_at_time jsonb,
  conservative_bid numeric,
  target_bid numeric,
  maximum_safe_bid numeric,
  actual_winning_price numeric,
  actual_pct_of_assessment numeric,
  later_market_value numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_backtest_owner on public.backtest_records(owner_id);

-- ---------------------------------------------------------------------
-- ai_analysis_runs (Phase 4) & audit_logs
-- ---------------------------------------------------------------------
create table if not exists public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  provider text,               -- anthropic | google | openai
  model text,
  task text,
  prompt_ref text,             -- reference only; never store secrets
  output jsonb,                -- Zod-validated structured output
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_owner on public.audit_logs(owner_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'users','properties','tax_sale_events','underwriting_runs'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;
