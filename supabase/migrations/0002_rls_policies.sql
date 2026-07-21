-- =====================================================================
-- TaxSale Copilot — Row Level Security
-- =====================================================================
-- Internal single-analyst-or-small-team tool: a user may read/write only
-- rows they own. Ownership is enforced directly on top-level tables and by
-- join to the parent property for child tables.
-- =====================================================================

-- Enable RLS on every table.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'users','properties','tax_sale_events','property_sources',
      'property_documents','property_images','comparable_sales',
      'rental_comparables','market_valuations','renovation_estimates',
      'rental_estimates','risk_assessments','underwriting_runs',
      'bid_scenarios','evidence_items','backtest_records',
      'ai_analysis_runs','audit_logs'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- users: a user manages only their own row.
drop policy if exists users_self on public.users;
create policy users_self on public.users
  using (id = auth.uid()) with check (id = auth.uid());

-- properties: owned directly.
drop policy if exists properties_owner on public.properties;
create policy properties_owner on public.properties
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- underwriting_runs & backtest_records & ai_analysis_runs: owned directly.
drop policy if exists runs_owner on public.underwriting_runs;
create policy runs_owner on public.underwriting_runs
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists backtest_owner on public.backtest_records;
create policy backtest_owner on public.backtest_records
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ai_owner on public.ai_analysis_runs;
create policy ai_owner on public.ai_analysis_runs
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists audit_owner on public.audit_logs;
create policy audit_owner on public.audit_logs
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Child tables: access follows ownership of the parent property.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'tax_sale_events','property_sources','property_documents',
      'property_images','comparable_sales','rental_comparables',
      'market_valuations','renovation_estimates','rental_estimates',
      'risk_assessments','evidence_items'
    ])
  loop
    execute format($f$
      drop policy if exists %1$s_via_property on public.%1$s;
      create policy %1$s_via_property on public.%1$s
        using (exists (
          select 1 from public.properties p
          where p.id = %1$s.property_id and p.owner_id = auth.uid()))
        with check (exists (
          select 1 from public.properties p
          where p.id = %1$s.property_id and p.owner_id = auth.uid()));
    $f$, t);
  end loop;
end $$;

-- bid_scenarios: follows ownership of the parent underwriting run.
drop policy if exists bid_scenarios_via_run on public.bid_scenarios;
create policy bid_scenarios_via_run on public.bid_scenarios
  using (exists (
    select 1 from public.underwriting_runs r
    where r.id = bid_scenarios.underwriting_run_id and r.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.underwriting_runs r
    where r.id = bid_scenarios.underwriting_run_id and r.owner_id = auth.uid()));

-- On new auth user, mirror into public.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
