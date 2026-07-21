import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyRecord, SourceType } from "./schema";
import type { PropertyStore } from "./store";
import { underwrite, withDefaults } from "@/lib/underwriting";

/**
 * Supabase-backed persistence. Satisfies the same `PropertyStore` interface as
 * the local file store, so the UI and engine are unchanged.
 *
 * Ownership: every write stamps `owner_id` + `created_by` with the current
 * auth user. Reads are additionally constrained by RLS at the database level —
 * even a bug here cannot return another user's rows.
 *
 * A property's underwriting input is stored on its most-recent
 * `underwriting_runs` row (jsonb `input`), alongside a denormalized snapshot
 * (verdict / max safe bid / score / confidence) for cheap dashboard queries.
 */
export class SupabasePropertyStore implements PropertyStore {
  constructor(private readonly db: SupabaseClient) {}

  private async userId(): Promise<string> {
    const {
      data: { user },
    } = await this.db.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return user.id;
  }

  async list(): Promise<PropertyRecord[]> {
    const { data: props, error } = await this.db
      .from("properties")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    if (!props || props.length === 0) return [];

    const ids = props.map((p) => p.id);
    const { data: runs } = await this.db
      .from("underwriting_runs")
      .select("property_id, input, created_at")
      .in("property_id", ids)
      .order("created_at", { ascending: false });

    const latestInput = new Map<string, unknown>();
    for (const r of runs ?? []) {
      if (!latestInput.has(r.property_id)) latestInput.set(r.property_id, r.input);
    }

    return props.map((p) => this.toRecord(p, latestInput.get(p.id)));
  }

  async get(id: string): Promise<PropertyRecord | null> {
    const { data: p, error } = await this.db.from("properties").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!p) return null;
    const { data: run } = await this.db
      .from("underwriting_runs")
      .select("input")
      .eq("property_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return this.toRecord(p, run?.input);
  }

  async create(
    input: Omit<PropertyRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<PropertyRecord> {
    const uid = await this.userId();
    const normalized = withDefaults(input.input);
    const meta = normalized.meta;

    const { data: prop, error } = await this.db
      .from("properties")
      .insert({
        owner_id: uid,
        created_by: uid,
        updated_by: uid,
        name: input.name,
        address: input.address ?? null,
        municipality: input.municipality ?? null,
        county: input.county ?? null,
        property_type: meta.propertyType ?? null,
        waterfront: !!meta.waterfront,
        rural: !!meta.rural,
        lot_size_acres: meta.lotSizeAcres ?? null,
        bedrooms: meta.bedrooms ?? null,
        bathrooms: meta.bathrooms ?? null,
        source_name: input.source?.name ?? null,
        source_url: input.source?.url ?? null,
        source_date: input.source?.date ?? null,
        source_type: input.source?.type ?? "USER_ENTERED",
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.insertRun(prop.id, uid, normalized);
    return this.toRecord(prop, normalized);
  }

  async update(id: string, patch: Partial<PropertyRecord>): Promise<PropertyRecord | null> {
    const uid = await this.userId();
    const existing = await this.get(id);
    if (!existing) return null;

    const fields: Record<string, unknown> = { updated_by: uid };
    if (patch.name !== undefined) fields.name = patch.name;
    if (patch.address !== undefined) fields.address = patch.address;
    if (patch.municipality !== undefined) fields.municipality = patch.municipality;
    if (patch.county !== undefined) fields.county = patch.county;
    if (patch.source !== undefined) {
      fields.source_name = patch.source?.name ?? null;
      fields.source_url = patch.source?.url ?? null;
      fields.source_date = patch.source?.date ?? null;
      fields.source_type = patch.source?.type ?? "USER_ENTERED";
    }
    const { error } = await this.db.from("properties").update(fields).eq("id", id);
    if (error) throw error;

    if (patch.input) {
      await this.insertRun(id, uid, withDefaults(patch.input));
    }
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("properties").delete().eq("id", id);
    if (error) throw error;
  }

  // --- helpers -----------------------------------------------------------
  private async insertRun(
    propertyId: string,
    uid: string,
    input: ReturnType<typeof withDefaults>,
  ): Promise<void> {
    const result = underwrite(input);
    const { error } = await this.db.from("underwriting_runs").insert({
      property_id: propertyId,
      owner_id: uid,
      created_by: uid,
      input,
      result: {
        verdict: result.verdict,
        bindingConstraint: result.bid.bindingConstraint,
      },
      engine_version: "phase-1.5",
      verdict: result.verdict,
      maximum_safe_bid: result.bid.maximumSafeBid,
      binding_constraint: result.bid.bindingConstraint,
      investment_score: result.score.total,
      overall_confidence: result.confidence.overall,
    });
    if (error) throw error;
  }

  private toRecord(p: Record<string, unknown>, input: unknown): PropertyRecord {
    const meta = {
      propertyType: (p.property_type as string) ?? undefined,
      waterfront: !!p.waterfront,
      rural: !!p.rural,
      lotSizeAcres: (p.lot_size_acres as number) ?? undefined,
      bedrooms: (p.bedrooms as number) ?? undefined,
      bathrooms: (p.bathrooms as number) ?? undefined,
    };
    const normalized = withDefaults((input as object) ?? {});
    // Ensure identity meta from the properties table wins over stale run meta.
    normalized.meta = { ...normalized.meta, ...clean(meta) };
    return {
      id: p.id as string,
      name: p.name as string,
      address: (p.address as string) ?? undefined,
      municipality: (p.municipality as string) ?? undefined,
      county: (p.county as string) ?? undefined,
      createdAt: (p.created_at as string) ?? new Date().toISOString(),
      updatedAt: (p.updated_at as string) ?? new Date().toISOString(),
      createdBy: (p.created_by as string) ?? undefined,
      source: {
        name: (p.source_name as string) ?? undefined,
        url: (p.source_url as string) ?? undefined,
        date: (p.source_date as string) ?? undefined,
        type: ((p.source_type as SourceType) ?? "USER_ENTERED") as SourceType,
      },
      input: normalized,
    };
  }
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
