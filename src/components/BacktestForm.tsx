"use client";

import * as React from "react";
import { createBacktestAction } from "@/app/backtest/actions";
import { Card } from "./ui";
import { money, VERDICT_LABEL } from "@/lib/format";
import type { Verdict } from "@/lib/underwriting";

export interface PresaleOption {
  id: string;
  name: string;
  municipality?: string;
  taxSaleDate: string | null;
  minimumTender: number;
  prediction: {
    marketValue: number;
    arv: number;
    renovation: number;
    rent: number;
    noi: number;
    conservativeBid: number;
    targetBid: number;
    maxSafeBid: number;
    walkAwayBid: number;
    confidence: number;
    verdict: Verdict;
  };
}

export function BacktestForm({ options }: { options: PresaleOption[] }) {
  const [propertyId, setPropertyId] = React.useState(options[0]?.id ?? "");
  const [actualWinningBid, setBid] = React.useState("");
  const [actualSalePriceLater, setLater] = React.useState("");
  const [actualArv, setArv] = React.useState("");
  const [actualRenovation, setReno] = React.useState("");
  const [actualMonthlyRent, setRent] = React.useState("");
  const [actualRefinanceValue, setRefi] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = options.find((o) => o.id === propertyId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createBacktestAction({
      propertyId,
      actuals: {
        actualWinningBid,
        actualSalePriceLater: actualSalePriceLater || undefined,
        actualArv: actualArv || undefined,
        actualRenovation: actualRenovation || undefined,
        actualMonthlyRent: actualMonthlyRent || undefined,
        actualRefinanceValue: actualRefinanceValue || undefined,
        notes,
      },
    });
    if (res && !res.ok) {
      setError(res.error);
      setPending(false);
    }
  }

  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New Historical Backtest</h1>
        <Card>
          <p className="text-sm text-muted">
            No properties available. First create a property using <b>only pre-sale information</b>,
            then return here to enter the actual outcome.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <h1 className="text-2xl font-bold">New Historical Backtest</h1>

      <label className="block max-w-xl">
        <span className="mb-1 block text-xs text-muted">Historical property (pre-sale snapshot)</span>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.taxSaleDate ? ` — ${o.taxSaleDate}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* PRE-SALE — read-only, clearly the frozen prediction */}
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">🔒 PRE-SALE</span>
            <h2 className="text-sm font-semibold uppercase tracking-wide">What we knew before the sale</h2>
          </div>
          <p className="mb-3 text-xs text-muted">Frozen prediction from the property snapshot. Read-only — you cannot edit it here.</p>
          {selected && (
            <div className="space-y-1 text-sm">
              <ReadRow k="Estimated market value" v={money(selected.prediction.marketValue)} />
              <ReadRow k="Estimated ARV" v={money(selected.prediction.arv)} />
              <ReadRow k="Estimated renovation" v={money(selected.prediction.renovation)} />
              <ReadRow k="Estimated rent (base)" v={money(selected.prediction.rent)} />
              <ReadRow k="Estimated NOI" v={money(selected.prediction.noi)} />
              <ReadRow k="Conservative bid" v={money(selected.prediction.conservativeBid)} />
              <ReadRow k="Target bid" v={money(selected.prediction.targetBid)} />
              <ReadRow k="Maximum safe bid" v={money(selected.prediction.maxSafeBid)} strong />
              <ReadRow k="Walk-away bid" v={money(selected.prediction.walkAwayBid)} />
              <ReadRow k="Minimum tender" v={money(selected.minimumTender)} />
              <ReadRow k="Confidence" v={`${selected.prediction.confidence}/100`} />
              <ReadRow k="Verdict" v={VERDICT_LABEL[selected.prediction.verdict]} strong />
            </div>
          )}
        </div>

        {/* ACTUAL — editable, visually distinct (amber) */}
        <div className="rounded-xl border-2 border-warn/50 bg-warn/5 p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">📓 POST-SALE</span>
            <h2 className="text-sm font-semibold uppercase tracking-wide">What actually happened</h2>
          </div>
          <p className="mb-3 text-xs text-warn">
            Enter these ONLY from post-sale records. They are used to score the prediction and are never
            fed back into it.
          </p>
          <div className="space-y-3">
            <Field label="Actual winning bid ($) *" value={actualWinningBid} onChange={setBid} required />
            <Field label="Actual renovation cost ($)" value={actualRenovation} onChange={setReno} />
            <Field label="Actual achieved rent ($/mo)" value={actualMonthlyRent} onChange={setRent} />
            <Field label="Actual market / appraisal / resale value ($)" value={actualSalePriceLater} onChange={setLater} />
            <Field label="Actual ARV realized ($)" value={actualArv} onChange={setArv} />
            <Field label="Actual refinance value ($)" value={actualRefinanceValue} onChange={setRefi} />
            <label className="block">
              <span className="mb-1 block text-xs text-warn">Post-sale notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-warn/40 bg-surface2 px-3 py-2 text-sm outline-none focus:border-warn" />
            </label>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-bad/40">
          <p className="text-sm text-bad">{error}</p>
        </Card>
      )}

      <button
        type="submit"
        disabled={pending || !actualWinningBid}
        className="rounded-md bg-accent px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Running backtest…" : "Run backtest"}
      </button>
    </form>
  );
}

function ReadRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-0.5">
      <span className="text-xs text-muted">{k}</span>
      <span className={`tnum text-sm ${strong ? "font-semibold" : ""}`}>{v}</span>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-warn">{label}</span>
      <input
        type="number"
        step="any"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-warn/40 bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-warn"
      />
    </label>
  );
}
