import { getPropertyStore } from "@/lib/data/store";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { underwrite } from "@/lib/underwriting";
import { BacktestForm, type PresaleOption } from "@/components/BacktestForm";

export const dynamic = "force-dynamic";

export default async function NewBacktestPage() {
  await requireAuthorizedUser();
  const properties = await getPropertyStore().list();

  const options: PresaleOption[] = properties.map((p) => {
    const r = underwrite(p.input);
    return {
      id: p.id,
      name: p.name,
      municipality: p.municipality,
      taxSaleDate: p.input.taxSale.saleDate ?? null,
      minimumTender: p.input.taxSale.minimumTender,
      prediction: {
        marketValue: r.valuation ? r.valuation.base : p.input.value.conservativeAsIs,
        arv: p.input.refinance.arv,
        renovation: r.renovationModel.baseWithContingency,
        rent: r.rent.base,
        noi: r.noiBreakdown.noi,
        conservativeBid: r.bid.conservativeBid,
        targetBid: r.bid.targetBid,
        maxSafeBid: r.bid.maximumSafeBid,
        walkAwayBid: r.bid.walkAwayBid,
        confidence: r.confidence.overall,
        verdict: r.verdict,
      },
    };
  });

  return <BacktestForm options={options} />;
}
