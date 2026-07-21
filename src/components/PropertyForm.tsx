"use client";

import * as React from "react";
import { DEFAULT_INPUT } from "@/lib/underwriting";
import type { RiskItem, EvidenceItem } from "@/lib/underwriting";
import { SAMPLE_PROPERTY_INPUT } from "@/lib/data/sample";
import { withDefaults } from "@/lib/underwriting";
import { createPropertyAction, geocodeAddressAction } from "@/app/actions";
import { Card, Section, Badge } from "./ui";

// Loose, form-friendly clone of the input (numbers held as-is).
type FormInput = typeof DEFAULT_INPUT;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function PropertyForm() {
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [county, setCounty] = React.useState("");
  const [input, setInput] = React.useState<FormInput>(clone(DEFAULT_INPUT));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [geoMsg, setGeoMsg] = React.useState<string | null>(null);
  const [geoBusy, setGeoBusy] = React.useState(false);

  function num(path: string, value: string) {
    setInput((prev) => {
      const next = clone(prev);
      setPath(next as unknown as Record<string, unknown>, path, value === "" ? 0 : Number(value));
      return next;
    });
  }
  function str(path: string, value: string) {
    setInput((prev) => {
      const next = clone(prev);
      setPath(next as unknown as Record<string, unknown>, path, value);
      return next;
    });
  }
  function bool(path: string, value: boolean) {
    setInput((prev) => {
      const next = clone(prev);
      setPath(next as unknown as Record<string, unknown>, path, value);
      return next;
    });
  }

  function loadSample() {
    const s = withDefaults(SAMPLE_PROPERTY_INPUT);
    setInput(clone(s) as FormInput);
    setName("Sample — 3BR Detached on 2.17 acres (rural Ontario)");
    setMunicipality("Sample Township");
    setCounty("Sample County");
    setAddress("123 Example Rd (illustrative)");
  }

  async function geocodeSubject() {
    setGeoBusy(true);
    setGeoMsg(null);
    const query = [address, municipality, county, "Ontario, Canada"].filter(Boolean).join(", ");
    const res = await geocodeAddressAction(query);
    setGeoBusy(false);
    if (!res) {
      setGeoMsg("Geocoding unavailable or address not found. Set GOOGLE_MAPS_API_KEY, or enter lat/lng manually.");
      return;
    }
    setInput((prev) => {
      const next = clone(prev);
      setPath(next as unknown as Record<string, unknown>, "meta.lat", res.lat);
      setPath(next as unknown as Record<string, unknown>, "meta.lng", res.lng);
      return next;
    });
    setGeoMsg(`Located: ${res.formattedAddress} (${res.lat.toFixed(5)}, ${res.lng.toFixed(5)})`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createPropertyAction({ name, address, municipality, county, input });
    // On success the action redirects and this line is not reached.
    if (res && !res.ok) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Property</h1>
        <button
          type="button"
          onClick={loadSample}
          className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs hover:bg-border"
        >
          Load sample data
        </button>
      </div>

      {error && (
        <Card className="border-bad/40">
          <p className="text-sm text-bad">Validation error: {error}</p>
        </Card>
      )}

      <Section title="Identity">
        <div className="grid gap-3 md:grid-cols-2">
          <Text label="Name *" value={name} onChange={setName} required />
          <Text label="Address" value={address} onChange={setAddress} />
          <Text label="Municipality" value={municipality} onChange={setMunicipality} />
          <Text label="County / District" value={county} onChange={setCounty} />
          <Text label="Property type" value={input.meta.propertyType ?? ""} onChange={(v) => str("meta.propertyType", v)} />
          <Num label="Lot size (acres)" path="meta.lotSizeAcres" input={input} onNum={num} />
          <Num label="Bedrooms" path="meta.bedrooms" input={input} onNum={num} />
          <Num label="Bathrooms" path="meta.bathrooms" input={input} onNum={num} />
          <Num label="Latitude" path="meta.lat" input={input} onNum={num} step="0.00001" />
          <Num label="Longitude" path="meta.lng" input={input} onNum={num} step="0.00001" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-6">
          <Check label="Waterfront" checked={!!input.meta.waterfront} onChange={(v) => bool("meta.waterfront", v)} />
          <Check label="Rural" checked={!!input.meta.rural} onChange={(v) => bool("meta.rural", v)} />
          <button
            type="button"
            onClick={geocodeSubject}
            disabled={geoBusy}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs hover:bg-border disabled:opacity-50"
          >
            {geoBusy ? "Locating…" : "📍 Geocode address (Google Maps)"}
          </button>
        </div>
        {geoMsg && <p className="mt-2 text-xs text-muted">{geoMsg}</p>}
        <p className="mt-1 text-xs text-muted/70">
          Geocoding the subject + comparables lets the engine derive real distances, which raises
          valuation confidence for nearby comps.
        </p>
      </Section>

      <Section title="Tax Sale">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Minimum tender ($)" path="taxSale.minimumTender" input={input} onNum={num} />
          <Num label="Tax arrears ($)" path="taxSale.taxArrears" input={input} onNum={num} />
          <Text label="Sale date" value={input.taxSale.saleDate ?? ""} onChange={(v) => str("taxSale.saleDate", v)} placeholder="YYYY-MM-DD" />
        </div>
      </Section>

      <Section title="Market Value" subtitle="Never trust assessed value alone. Enter conservative, evidence-based figures.">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Conservative as-is ($)" path="value.conservativeAsIs" input={input} onNum={num} />
          <Num label="Conservative ARV ($)" path="value.conservativeArv" input={input} onNum={num} />
          <Num label="Assessment (MPAC) ($)" path="value.assessment" input={input} onNum={num} />
          <Num label="Base value ($)" path="value.baseValue" input={input} onNum={num} />
          <Num label="Optimistic value ($)" path="value.optimisticValue" input={input} onNum={num} />
          <Num label="Margin of safety (0–1)" path="value.marginOfSafetyPct" input={input} onNum={num} step="0.01" />
          <Num label="Required equity buffer ($)" path="value.requiredEquityBuffer" input={input} onNum={num} />
        </div>
      </Section>

      <Section title="Acquisition Costs">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Land transfer tax mode"
            value={input.acquisition.landTransferTaxMode}
            onChange={(v) => str("acquisition.landTransferTaxMode", v)}
            options={[["ontario", "Ontario (brackets)"], ["percent", "Percent"], ["flat", "Flat $"]]}
          />
          <Num label="LTT percent (if %)" path="acquisition.landTransferTaxPct" input={input} onNum={num} step="0.001" />
          <Num label="LTT flat (if flat) ($)" path="acquisition.landTransferTaxFlat" input={input} onNum={num} />
          <Num label="Legal fees ($)" path="acquisition.legalFees" input={input} onNum={num} />
          <Num label="Title insurance ($)" path="acquisition.titleInsurance" input={input} onNum={num} />
          <Num label="Other closing ($)" path="acquisition.otherClosingCosts" input={input} onNum={num} />
        </div>
        <div className="mt-3">
          <Check label="Include Toronto MLTT" checked={!!input.acquisition.includeTorontoMLTT} onChange={(v) => bool("acquisition.includeTorontoMLTT", v)} />
        </div>
      </Section>

      <Section title="Renovation">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Cosmetic ($)" path="renovation.cosmetic" input={input} onNum={num} />
          <Num label="Major ($)" path="renovation.major" input={input} onNum={num} />
          <Num label="Structural ($)" path="renovation.structural" input={input} onNum={num} />
          <Num label="Contingency (0–1)" path="renovation.contingencyPct" input={input} onNum={num} step="0.01" />
          <Num label="Confidence (0–100)" path="renovation.confidence" input={input} onNum={num} />
        </div>
      </Section>

      <Section title="Financing (acquisition + reno)">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Financed on purchase (0–1)" path="financing.financedOnPurchasePct" input={input} onNum={num} step="0.01" />
          <Num label="Reno financed (0–1)" path="financing.renovationFinancedPct" input={input} onNum={num} step="0.01" />
          <Num label="Annual interest rate (0–1)" path="financing.annualInterestRate" input={input} onNum={num} step="0.001" />
          <Num label="Financing fees (0–1)" path="financing.financingFeesPct" input={input} onNum={num} step="0.001" />
          <Num label="Fixed lender fees ($)" path="financing.fixedLenderFees" input={input} onNum={num} />
        </div>
        <div className="mt-3">
          <Check label="Finance renovation" checked={!!input.financing.financeRenovation} onChange={(v) => bool("financing.financeRenovation", v)} />
        </div>
      </Section>

      <Section title="Holding (during renovation)">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Hold period (months)" path="holding.holdingPeriodMonths" input={input} onNum={num} />
          <Num label="Property tax / mo ($)" path="holding.monthlyPropertyTax" input={input} onNum={num} />
          <Num label="Insurance / mo ($)" path="holding.monthlyInsurance" input={input} onNum={num} />
          <Num label="Utilities / mo ($)" path="holding.monthlyUtilities" input={input} onNum={num} />
          <Num label="Maintenance / mo ($)" path="holding.monthlyMaintenance" input={input} onNum={num} />
          <Num label="Other / mo ($)" path="holding.otherMonthly" input={input} onNum={num} />
        </div>
      </Section>

      <Section title="Rental (stabilized)">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Market rent / mo ($)" path="rental.monthlyMarketRent" input={input} onNum={num} />
          <Num label="Vacancy (0–1)" path="rental.vacancyPct" input={input} onNum={num} step="0.01" />
          <Num label="Property tax / yr ($)" path="rental.annualPropertyTax" input={input} onNum={num} />
          <Num label="Insurance / yr ($)" path="rental.annualInsurance" input={input} onNum={num} />
          <Num label="Utilities / yr ($)" path="rental.annualUtilities" input={input} onNum={num} />
          <Num label="Maintenance (0–1 of EGI)" path="rental.maintenancePct" input={input} onNum={num} step="0.01" />
          <Num label="Management (0–1 of EGI)" path="rental.managementPct" input={input} onNum={num} step="0.01" />
          <Num label="Other opex / yr ($)" path="rental.otherAnnualOpEx" input={input} onNum={num} />
          <Num label="Confidence (0–100)" path="rental.confidence" input={input} onNum={num} />
        </div>
      </Section>

      <Section title="Refinance">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="ARV ($)" path="refinance.arv" input={input} onNum={num} />
          <Num label="Refi LTV (0–1)" path="refinance.refinanceLtv" input={input} onNum={num} step="0.01" />
          <Num label="Refi rate (0–1)" path="refinance.refinanceAnnualRate" input={input} onNum={num} step="0.001" />
          <Num label="Amortization (years)" path="refinance.refinanceAmortizationYears" input={input} onNum={num} />
          <Num label="Refi costs (0–1)" path="refinance.refinanceCostsPct" input={input} onNum={num} step="0.001" />
          <Num label="Fixed refi costs ($)" path="refinance.fixedRefinanceCosts" input={input} onNum={num} />
        </div>
      </Section>

      <Section title="Return Requirements & Capital">
        <div className="grid gap-3 md:grid-cols-3">
          <Num label="Min cash-on-cash (0–1)" path="returns.minCashOnCash" input={input} onNum={num} step="0.01" />
          <Num label="Min DSCR (×)" path="returns.minDscr" input={input} onNum={num} step="0.05" />
          <Num label="Min monthly cash flow ($)" path="returns.minMonthlyCashFlow" input={input} onNum={num} />
          <Num label="Max capital trapped ($)" path="returns.maxCapitalTrapped" input={input} onNum={num} />
          <Num label="Max capital available ($, optional)" path="capital.maxCapitalAvailable" input={input} onNum={num} />
          <Num label="Conservative bid factor (0–1)" path="bidShape.conservativeBidFactor" input={input} onNum={num} step="0.01" />
          <Num label="Target bid factor (0–1)" path="bidShape.targetBidFactor" input={input} onNum={num} step="0.01" />
        </div>
      </Section>

      <RiskEditor risks={input.risks} onChange={(risks) => setInput((p) => ({ ...clone(p), risks }))} />
      <EvidenceEditor evidence={input.evidence} onChange={(evidence) => setInput((p) => ({ ...clone(p), evidence }))} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Underwriting…" : "Create & underwrite"}
        </button>
        <span className="text-xs text-muted">Values are validated, then run through the deterministic engine.</span>
      </div>
    </form>
  );
}

// ---- field primitives -----------------------------------------------------
function fieldValue(input: unknown, path: string): string {
  const v = getPath(input, path);
  if (v === undefined || v === null) return "";
  return String(v);
}

function Num({
  label,
  path,
  input,
  onNum,
  step,
}: {
  label: string;
  path: string;
  input: unknown;
  onNum: (path: string, value: string) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="number"
        step={step ?? "any"}
        value={fieldValue(input, path)}
        onChange={(e) => onNum(path, e.target.value)}
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-accent"
      />
    </label>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

const RISK_CATEGORIES = ["TITLE", "ACCESS", "ENVIRONMENTAL", "FLOOD", "ZONING", "STRUCTURAL", "LEGAL", "RENTAL", "LIQUIDITY", "UTILITIES", "CONDITION", "OTHER"];
const SEVERITIES = ["FATAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const STATUSES = ["VERIFIED", "ESTIMATED", "INFERRED", "USER_PROVIDED", "AI_SUGGESTED", "UNKNOWN"];

function RiskEditor({ risks, onChange }: { risks: RiskItem[]; onChange: (r: RiskItem[]) => void }) {
  function add() {
    onChange([...risks, { category: "CONDITION", severity: "UNKNOWN", label: "", dataStatus: "UNKNOWN" }]);
  }
  function update(i: number, patch: Partial<RiskItem>) {
    onChange(risks.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(risks.filter((_, idx) => idx !== i));
  }
  return (
    <Section title="Risk Register / Deal Killers" right={<button type="button" onClick={add} className="text-xs text-accent hover:underline">+ Add risk</button>}>
      {risks.length === 0 && <p className="text-sm text-muted">No risks yet. Unknowns are treated as risky — record what you have not verified.</p>}
      <div className="space-y-3">
        {risks.map((r, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface2 p-3">
            <div className="grid gap-2 md:grid-cols-4">
              <Select label="Category" value={r.category} onChange={(v) => update(i, { category: v as RiskItem["category"] })} options={RISK_CATEGORIES.map((c) => [c, c])} />
              <Select label="Severity" value={r.severity} onChange={(v) => update(i, { severity: v as RiskItem["severity"] })} options={SEVERITIES.map((c) => [c, c])} />
              <Select label="Data status" value={r.dataStatus} onChange={(v) => update(i, { dataStatus: v as RiskItem["dataStatus"] })} options={STATUSES.map((c) => [c, c])} />
              <label className="flex items-end gap-2 pb-2 text-xs">
                <input type="checkbox" checked={!!r.fatalIfConfirmed} onChange={(e) => update(i, { fatalIfConfirmed: e.target.checked })} /> Fatal if confirmed
              </label>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Text label="Label" value={r.label} onChange={(v) => update(i, { label: v })} />
              <Text label="Detail" value={r.detail ?? ""} onChange={(v) => update(i, { detail: v })} />
            </div>
            <button type="button" onClick={() => remove(i)} className="mt-2 text-xs text-bad hover:underline">Remove</button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function EvidenceEditor({ evidence, onChange }: { evidence: EvidenceItem[]; onChange: (e: EvidenceItem[]) => void }) {
  function add() {
    onChange([...evidence, { claim: "", source: "", dataStatus: "USER_PROVIDED" }]);
  }
  function update(i: number, patch: Partial<EvidenceItem>) {
    onChange(evidence.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function remove(i: number) {
    onChange(evidence.filter((_, idx) => idx !== i));
  }
  return (
    <Section title="Evidence & Provenance" right={<button type="button" onClick={add} className="text-xs text-accent hover:underline">+ Add evidence</button>}>
      {evidence.length === 0 && <p className="text-sm text-muted">Add comparable sales and rental comps to raise valuation confidence.</p>}
      <div className="space-y-3">
        {evidence.map((e, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface2 p-3">
            <div className="grid gap-2 md:grid-cols-3">
              <Text label="Claim" value={e.claim} onChange={(v) => update(i, { claim: v })} />
              <Text label="Value" value={e.value ?? ""} onChange={(v) => update(i, { value: v })} />
              <Text label="Source" value={e.source} onChange={(v) => update(i, { source: v })} />
              <Text label="Source type" value={e.sourceType ?? ""} onChange={(v) => update(i, { sourceType: v })} />
              <Text label="Date (YYYY-MM-DD)" value={e.date ?? ""} onChange={(v) => update(i, { date: v })} />
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Distance (km)</span>
                <input type="number" step="any" value={e.distanceKm ?? ""} onChange={(ev) => update(i, { distanceKm: ev.target.value === "" ? undefined : Number(ev.target.value) })} className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-accent" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Latitude (optional)</span>
                <input type="number" step="any" value={e.lat ?? ""} onChange={(ev) => update(i, { lat: ev.target.value === "" ? undefined : Number(ev.target.value) })} className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-accent" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Longitude (optional)</span>
                <input type="number" step="any" value={e.lng ?? ""} onChange={(ev) => update(i, { lng: ev.target.value === "" ? undefined : Number(ev.target.value) })} className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm tnum outline-none focus:border-accent" />
              </label>
            </div>
            <p className="mt-1 text-xs text-muted/70">If distance is blank but lat/lng are set (and the subject is geocoded), the engine computes distance automatically.</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-56">
                <Select label="Data status" value={e.dataStatus} onChange={(v) => update(i, { dataStatus: v as EvidenceItem["dataStatus"] })} options={STATUSES.map((c) => [c, c])} />
              </div>
              <button type="button" onClick={() => remove(i)} className="mt-4 text-xs text-bad hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted"><Badge tone="muted">Reminder</Badge> Never fabricate sources. Label everything with its true data status.</p>
    </Section>
  );
}

// ---- tiny path helpers ----------------------------------------------------
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}
