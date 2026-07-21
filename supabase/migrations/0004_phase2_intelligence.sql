-- =====================================================================
-- TaxSale Copilot — Phase 2: comparable/valuation/memo columns.
-- Non-destructive: adds columns only. The engine input (jsonb) already
-- carries comps + renovation line items; these columns support querying and
-- reproducible memo snapshots.
-- =====================================================================

-- Richer comparable-sales attributes used by the similarity engine.
alter table public.comparable_sales
  add column if not exists building_sqft numeric,
  add column if not exists lot_acres numeric,
  add column if not exists bedrooms int,
  add column if not exists bathrooms numeric,
  add column if not exists year_built int,
  add column if not exists condition text,
  add column if not exists price_per_sqft numeric,
  add column if not exists similarity_score numeric;

-- Market valuation Low/Base/High + method/weights.
alter table public.market_valuations
  add column if not exists low_value numeric,
  add column if not exists base_value numeric,
  add column if not exists high_value numeric,
  add column if not exists method text,
  add column if not exists weights jsonb;

-- Store the full Investment Committee Memo snapshot for reproducibility.
alter table public.underwriting_runs
  add column if not exists memo jsonb,
  add column if not exists strategy text;

-- Comparable-rentals table (referenced by rental analysis; created if absent).
create table if not exists public.comparable_rentals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  address text,
  monthly_rent numeric,
  bedrooms int,
  bathrooms numeric,
  distance_km numeric,
  listed_date date,
  source_name text,
  source_type text default 'USER_ENTERED',
  data_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_comp_rentals_property on public.comparable_rentals(property_id);

-- RLS for the new table (owner-of-parent-property model).
alter table public.comparable_rentals enable row level security;
drop policy if exists comparable_rentals_via_property on public.comparable_rentals;
create policy comparable_rentals_via_property on public.comparable_rentals
  using (exists (
    select 1 from public.properties p
    where p.id = comparable_rentals.property_id
      and (p.owner_id = auth.uid() or p.created_by = auth.uid())))
  with check (exists (
    select 1 from public.properties p
    where p.id = comparable_rentals.property_id
      and (p.owner_id = auth.uid() or p.created_by = auth.uid())));
