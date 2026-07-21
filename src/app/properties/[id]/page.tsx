import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyStore } from "@/lib/data/store";
import { underwrite } from "@/lib/underwriting";
import { UnderwritingReport } from "@/components/UnderwritingReport";
import { Badge } from "@/components/ui";
import { deletePropertyAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const store = getPropertyStore();
  const property = await store.get(params.id);
  if (!property) notFound();

  const result = underwrite(property.input);
  const meta = property.input.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-muted hover:text-text">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{property.name}</h1>
          <p className="text-sm text-muted">
            {[property.address, property.municipality, property.county].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {meta.propertyType && <Badge>{meta.propertyType}</Badge>}
            {meta.bedrooms != null && <Badge>{meta.bedrooms} bd</Badge>}
            {meta.bathrooms != null && <Badge>{meta.bathrooms} ba</Badge>}
            {meta.lotSizeAcres != null && <Badge>{meta.lotSizeAcres} ac</Badge>}
            {meta.waterfront && <Badge tone="accent">Waterfront</Badge>}
            {meta.rural && <Badge tone="warn">Rural</Badge>}
          </div>
        </div>
        <form action={deletePropertyAction.bind(null, property.id)}>
          <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-bad hover:text-bad">
            Delete
          </button>
        </form>
      </div>

      <UnderwritingReport input={property.input} result={result} />
    </div>
  );
}
