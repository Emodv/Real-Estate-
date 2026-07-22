"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPropertyStore } from "@/lib/data/store";
import { getBacktestStore } from "@/lib/data/backtestStore";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { runBacktest, type BacktestActuals } from "@/lib/backtest/backtest";

const actualsSchema = z.object({
  actualWinningBid: z.coerce.number().finite(),
  actualSalePriceLater: z.coerce.number().optional(),
  actualArv: z.coerce.number().optional(),
  actualRenovation: z.coerce.number().optional(),
  actualMonthlyRent: z.coerce.number().optional(),
  actualRefinanceValue: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export interface CreateBacktestPayload {
  propertyId: string;
  actuals: unknown;
}

export async function createBacktestAction(payload: CreateBacktestPayload) {
  const user = await requireAuthorizedUser();
  const property = await getPropertyStore().get(payload.propertyId);
  if (!property) return { ok: false as const, error: "Property not found." };

  const parsed = actualsSchema.safeParse(payload.actuals);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const actuals: BacktestActuals = parsed.data;

  // HINDSIGHT GUARD: runBacktest underwrites property.input (pre-sale) only.
  const outcome = runBacktest(property.input, actuals);

  const record = await getBacktestStore().create({
    name: property.name,
    propertyId: property.id,
    taxSaleDate: property.input.taxSale.saleDate,
    createdBy: user.id,
    actuals,
    preSaleSnapshot: property.input,
    outcome,
    notes: actuals.notes,
  });

  revalidatePath("/backtest");
  redirect(`/backtest/${record.id}`);
}

export async function deleteBacktestAction(id: string) {
  await requireAuthorizedUser();
  await getBacktestStore().remove(id);
  revalidatePath("/backtest");
  redirect("/backtest");
}
