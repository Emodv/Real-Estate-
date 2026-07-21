import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PropertyRecord } from "./schema";
import { withDefaults } from "@/lib/underwriting";
import { SAMPLE_PROPERTY_INPUT } from "./sample";
import { isSupabaseMode } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabasePropertyStore } from "./supabaseStore";

/**
 * Persistence abstraction.
 *
 * Phase 1 ships a local JSON-file store so the whole app is runnable with zero
 * cloud setup (`NEXT_PUBLIC_APP_MODE=local`). The same `PropertyStore`
 * interface is what a Supabase-backed implementation will satisfy in the full
 * mode — the underwriting engine and UI never talk to storage directly, so
 * swapping the backend does not touch business logic.
 *
 * NOTE: The Supabase schema (supabase/migrations) is the source of truth for
 * the production data model; this file-store mirrors only the subset Phase 1
 * needs (one property record carrying its underwriting input).
 */
export interface PropertyStore {
  list(): Promise<PropertyRecord[]>;
  get(id: string): Promise<PropertyRecord | null>;
  create(input: Omit<PropertyRecord, "id" | "createdAt" | "updatedAt">): Promise<PropertyRecord>;
  update(id: string, patch: Partial<PropertyRecord>): Promise<PropertyRecord | null>;
  remove(id: string): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "properties.json");

async function readAll(): Promise<PropertyRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PropertyRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: PropertyRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

function seedRecord(): PropertyRecord {
  const now = new Date().toISOString();
  return {
    id: "sample-ontario-taxsale",
    name: "Sample — 3BR Detached on 2.17 acres (rural Ontario)",
    address: "123 Example Rd (illustrative, manually entered)",
    municipality: "Sample Township",
    county: "Sample County",
    createdAt: now,
    updatedAt: now,
    input: withDefaults(SAMPLE_PROPERTY_INPUT),
  };
}

class LocalFilePropertyStore implements PropertyStore {
  async list(): Promise<PropertyRecord[]> {
    let all = await readAll();
    if (all.length === 0) {
      all = [seedRecord()];
      await writeAll(all);
    }
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<PropertyRecord | null> {
    const all = await this.list();
    return all.find((r) => r.id === id) ?? null;
  }

  async create(
    input: Omit<PropertyRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<PropertyRecord> {
    const all = await this.list();
    const now = new Date().toISOString();
    const record: PropertyRecord = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    all.push(record);
    await writeAll(all);
    return record;
  }

  async update(id: string, patch: Partial<PropertyRecord>): Promise<PropertyRecord | null> {
    const all = await this.list();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated: PropertyRecord = {
      ...all[idx],
      ...patch,
      id: all[idx].id,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    await writeAll(all);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await writeAll(all.filter((r) => r.id !== id));
  }
}

let localSingleton: PropertyStore | null = null;

/**
 * Returns the active property store for the current request.
 *
 * - `supabase` mode: a fresh, request-scoped `SupabasePropertyStore` bound to
 *   the caller's session cookies (so RLS applies and writes are owned by the
 *   signed-in user).
 * - `local` mode: a process-wide local JSON-file store (no auth).
 */
export function getPropertyStore(): PropertyStore {
  if (isSupabaseMode()) {
    const db = createSupabaseServerClient();
    if (db) return new SupabasePropertyStore(db);
  }
  if (!localSingleton) localSingleton = new LocalFilePropertyStore();
  return localSingleton;
}
