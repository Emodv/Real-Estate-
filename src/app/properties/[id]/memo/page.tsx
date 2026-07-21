import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyStore } from "@/lib/data/store";
import { underwrite, buildMemo } from "@/lib/underwriting";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { MemoDocument } from "@/components/MemoDocument";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function MemoPage({ params }: { params: { id: string } }) {
  await requireAuthorizedUser();
  const property = await getPropertyStore().get(params.id);
  if (!property) notFound();

  const result = underwrite(property.input);
  const memo = buildMemo(property.input, result);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/properties/${property.id}`} className="text-xs text-muted hover:text-text">
          ← Back to analysis
        </Link>
        <PrintButton />
      </div>
      <MemoDocument
        memo={memo}
        header={{
          name: property.name,
          address: property.address,
          municipality: property.municipality,
          county: property.county,
        }}
      />
    </div>
  );
}
