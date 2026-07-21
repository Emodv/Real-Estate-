"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPropertyStore } from "@/lib/data/store";
import { underwritingInputSchema } from "@/lib/data/schema";
import { withDefaults } from "@/lib/underwriting";

export interface CreatePropertyPayload {
  name: string;
  address?: string;
  municipality?: string;
  county?: string;
  input: unknown;
}

/**
 * Validate + persist a new property. All financial fields pass through the Zod
 * schema (coercion + finiteness) before touching the store or the engine.
 */
export async function createPropertyAction(payload: CreatePropertyPayload) {
  const parsed = underwritingInputSchema.safeParse(payload.input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const store = getPropertyStore();
  const record = await store.create({
    name: payload.name?.trim() || "Untitled property",
    address: payload.address?.trim() || undefined,
    municipality: payload.municipality?.trim() || undefined,
    county: payload.county?.trim() || undefined,
    input: withDefaults(parsed.data),
  });
  revalidatePath("/");
  redirect(`/properties/${record.id}`);
}

/**
 * Optional geocoding enrichment. Uses GOOGLE_MAPS_API_KEY on the server only.
 * Returns null when geocoding is disabled or the address can't be resolved —
 * callers fall back to manual coordinate entry.
 */
export async function geocodeAddressAction(
  address: string,
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const { geocodeAddress } = await import("@/lib/geo/google");
  const result = await geocodeAddress(address);
  if (!result) return null;
  return { ...result.coords, formattedAddress: result.formattedAddress };
}

export async function deletePropertyAction(id: string) {
  const store = getPropertyStore();
  await store.remove(id);
  revalidatePath("/");
  redirect("/");
}
