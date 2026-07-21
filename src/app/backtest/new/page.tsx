import { getPropertyStore } from "@/lib/data/store";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { BacktestForm } from "@/components/BacktestForm";

export const dynamic = "force-dynamic";

export default async function NewBacktestPage() {
  await requireAuthorizedUser();
  const properties = await getPropertyStore().list();
  return <BacktestForm properties={properties.map((p) => ({ id: p.id, name: p.name }))} />;
}
