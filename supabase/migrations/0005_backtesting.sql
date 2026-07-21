-- =====================================================================
-- TaxSale Copilot — Phase 2.5: historical backtesting.
-- Extends the existing backtest_records table (0001) with the richer
-- prediction/actual fields and frozen snapshots. Non-destructive.
-- =====================================================================

alter table public.backtest_records
  add column if not exists name text,
  add column if not exists actual_winning_bid numeric,
  add column if not exists pre_sale_snapshot jsonb,   -- frozen UnderwritingInput (pre-sale only)
  add column if not exists prediction_snapshot jsonb, -- frozen prediction (reproducibility)
  add column if not exists comparison_snapshot jsonb, -- frozen comparison vs actuals
  add column if not exists predicted_market_value numeric,
  add column if not exists predicted_arv numeric,
  add column if not exists predicted_renovation numeric,
  add column if not exists predicted_rent numeric,
  add column if not exists predicted_target_bid numeric,
  add column if not exists predicted_max_safe_bid numeric,
  add column if not exists predicted_walkaway_bid numeric,
  add column if not exists predicted_verdict text,
  add column if not exists predicted_score int,
  add column if not exists predicted_confidence int,
  add column if not exists actual_arv numeric,
  add column if not exists actual_renovation numeric,
  add column if not exists actual_rent numeric,
  add column if not exists post_sale_notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_backtest_property on public.backtest_records(property_id);

-- RLS already enabled + owner policy present from 0002. Refresh owner policy to
-- accept created_by (added in 0003 for other tables; backtest_records uses owner_id).
drop policy if exists backtest_owner on public.backtest_records;
create policy backtest_owner on public.backtest_records
  using (auth.uid() is not null and owner_id = auth.uid())
  with check (auth.uid() is not null and owner_id = auth.uid());
