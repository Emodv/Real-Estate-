"use client";

import * as React from "react";
import { createBacktestAction } from "@/app/backtest/actions";
import { Card, Section } from "./ui";

export function BacktestForm({ properties }: { properties: { id: string; name: string }[] }) {
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const [actualWinningBid, setBid] = React.useState("");
  const [actualSalePriceLater, setLater] = React.useState("");
  const [actualArv, setArv] = React.useState("");
  const [actualRenovation, setReno] = React.useState("");
  const [actualMonthlyRent, setRent] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        notes,
      },
    });
    if (res && !res.ok) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <h1 className="text-2xl font-bold">New Historical Backtest</h1>
      <Card>
        <p className="text-sm text-muted">
          Pick a property that was created using <b>only pre-sale information</b>. The engine
          re-underwrites that pre-sale snapshot and compares its prediction to the actual outcome.
          The actual figures below are <b>never</b> fed into the prediction.
        </p>
      </Card>

      {error && (
        <Card className="border-bad/40">
          <p className="text-sm text-bad">{error}</p>
        </Card>
      )}

      {properties.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No properties available. Create a property first (with pre-sale data only), then return here.
          </p>
        </Card>
      ) : (
        <>
          <Section title="Pre-sale property">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Property (pre-sale snapshot)</span>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Actual outcome (post-sale — used only for scoring)">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Actual winning bid ($) *" value={actualWinningBid} onChange={setBid} required />
              <Field label="Later resale / appraised value ($)" value={actualSalePriceLater} onChange={setLater} />
              <Field label="Actual renovation cost ($)" value={actualRenovation} onChange={setReno} />
              <Field label="Actual ARV realized ($)" value={actualArv} onChange={setArv} />
              <Field label="Actual monthly rent ($)" value={actualMonthlyRent} onChange={setRent} />
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-muted">Post-sale notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
          </Section>

          <button
            type="submit"
            disabled={pending || !actualWinningBid}
            className="rounded-md bg-accent px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Running backtest…" : "Run backtest"}
          </button>
        </>
      )}
    </form>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="number"
        step="any"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-accent"
      />
    </label>
  );
}
