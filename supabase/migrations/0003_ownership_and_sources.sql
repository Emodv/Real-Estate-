-- =====================================================================
-- TaxSale Copilot — Phase 1.5: ownership (created_by/updated_by) + source
-- provenance. Non-destructive: only adds columns, indexes, and policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- created_by / updated_by referencing auth.users
-- ---------------------------------------------------------------------
alter table public.properties
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.underwriting_runs
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Backfill created_by from the existing owner_id where present.
update public.properties        set created_by = owner_id where created_by is null;
update public.underwriting_runs set created_by = owner_id where created_by is null;

create index if not exists idx_properties_created_by on public.properties(created_by);
create index if not exists idx_runs_created_by on public.underwriting_runs(created_by);

-- ---------------------------------------------------------------------
-- Source provenance on properties + comparable_sales
--   source_type ∈ USER_ENTERED | GOOGLE_MAPS | MUNICIPAL_SOURCE |
--                ONTARIO_TAX_SALES | OTHER
-- ---------------------------------------------------------------------
alter table public.properties
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_date date,
  add column if not exists source_type text not null default 'USER_ENTERED';

alter table public.comparable_sales
  add column if not exists source_name text,
  add column if not exists source_date date,
  add column if not exists source_type text not null default 'USER_ENTERED';

-- Constrain source_type to the known vocabulary (guarded so re-runs are safe).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_source_type_chk') then
    alter table public.properties
      add constraint properties_source_type_chk
      check (source_type in ('USER_ENTERED','GOOGLE_MAPS','MUNICIPAL_SOURCE','ONTARIO_TAX_SALES','OTHER'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comparable_sales_source_type_chk') then
    alter table public.comparable_sales
      add constraint comparable_sales_source_type_chk
      check (source_type in ('USER_ENTERED','GOOGLE_MAPS','MUNICIPAL_SOURCE','ONTARIO_TAX_SALES','OTHER'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- updated_by-aware updated_at trigger already exists (set_updated_at).
-- Refresh RLS so ownership matches EITHER owner_id OR created_by, and so
-- anonymous access (auth.uid() is null) is always denied.
-- ---------------------------------------------------------------------
drop policy if exists properties_owner on public.properties;
create policy properties_owner on public.properties
  using (auth.uid() is not null and (owner_id = auth.uid() or created_by = auth.uid()))
  with check (auth.uid() is not null and (owner_id = auth.uid() or created_by = auth.uid()));

drop policy if exists runs_owner on public.underwriting_runs;
create policy runs_owner on public.underwriting_runs
  using (auth.uid() is not null and (owner_id = auth.uid() or created_by = auth.uid()))
  with check (auth.uid() is not null and (owner_id = auth.uid() or created_by = auth.uid()));

-- underwriting_runs must also belong to a property the user owns (defense in depth).
drop policy if exists runs_via_property on public.underwriting_runs;
create policy runs_via_property on public.underwriting_runs
  as restrictive
  using (exists (
    select 1 from public.properties p
    where p.id = underwriting_runs.property_id
      and (p.owner_id = auth.uid() or p.created_by = auth.uid())))
  with check (exists (
    select 1 from public.properties p
    where p.id = underwriting_runs.property_id
      and (p.owner_id = auth.uid() or p.created_by = auth.uid())));
