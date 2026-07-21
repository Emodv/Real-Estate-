"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPropertyStore } from "@/lib/data/store";
import { underwritingInputSchema, sourceMetaSchema } from "@/lib/data/schema";
import { withDefaults } from "@/lib/underwriting";
import { requireAuthorizedUser } from "@/lib/auth/session";

export interface CreatePropertyPayload {
  name: string;
  address?: string;
  municipality?: string;
  county?: string;
  source?: unknown;
  input: unknown;
}

/**
 * Validate + persist a new property. All financial fields pass through the Zod
 * schema (coercion + finiteness) before touching the store or the engine.
 */
export async function createPropertyAction(payload: CreatePropertyPayload) {
  await requireAuthorizedUser(); // authn + allowlist authz
  const parsed = underwritingInputSchema.safeParse(payload.input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const source = sourceMetaSchema.safeParse(payload.source ?? {});
  const store = getPropertyStore();
  const record = await store.create({
    name: payload.name?.trim() || "Untitled property",
    address: payload.address?.trim() || undefined,
    municipality: payload.municipality?.trim() || undefined,
    county: payload.county?.trim() || undefined,
    source: source.success ? source.data : { type: "USER_ENTERED" },
    input: withDefaults(parsed.data),
  });
  revalidatePath("/dashboard");
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
  await requireAuthorizedUser();
  const { geocodeAddress } = await import("@/lib/geo/google");
  const result = await geocodeAddress(address);
  if (!result) return null;
  return { ...result.coords, formattedAddress: result.formattedAddress };
}

export async function deletePropertyAction(id: string) {
  await requireAuthorizedUser();
  const store = getPropertyStore();
  await store.remove(id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
