import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UnderwritingInput } from "@/lib/underwriting";
import type { BacktestActuals, BacktestOutcome } from "@/lib/backtest/backtest";

/**
 * A historical backtest record. Stores the FROZEN pre-sale input snapshot and
 * the FROZEN prediction+comparison outcome, so the record remains reproducible
 * even if the underwriting engine changes later.
 */
export interface BacktestRecord {
  id: string;
  name: string;
  propertyId?: string;
  taxSaleDate?: string;
  createdAt: string;
  createdBy?: string;
  actuals: BacktestActuals;
  /** Pre-sale info ONLY (never contains post-sale actuals). */
  preSaleSnapshot: UnderwritingInput;
  outcome: BacktestOutcome;
  notes?: string;
}

export interface BacktestStore {
  list(): Promise<BacktestRecord[]>;
  get(id: string): Promise<BacktestRecord | null>;
  create(input: Omit<BacktestRecord, "id" | "createdAt">): Promise<BacktestRecord>;
  remove(id: string): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "backtests.json");

async function readAll(): Promise<BacktestRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BacktestRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: BacktestRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

class LocalFileBacktestStore implements BacktestStore {
  async list(): Promise<BacktestRecord[]> {
    return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string): Promise<BacktestRecord | null> {
    return (await readAll()).find((r) => r.id === id) ?? null;
  }
  async create(input: Omit<BacktestRecord, "id" | "createdAt">): Promise<BacktestRecord> {
    const all = await readAll();
    const record: BacktestRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    all.push(record);
    await writeAll(all);
    return record;
  }
  async remove(id: string): Promise<void> {
    await writeAll((await readAll()).filter((r) => r.id !== id));
  }
}

let singleton: BacktestStore | null = null;

/**
 * Returns the backtest store. Phase 2.5 ships the local file store; a
 * Supabase-backed store (table + RLS in migration 0005) is the calibration-phase
 * swap point.
 */
export function getBacktestStore(): BacktestStore {
  if (!singleton) singleton = new LocalFileBacktestStore();
  return singleton;
}
