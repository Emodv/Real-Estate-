import { PropertyForm } from "@/components/PropertyForm";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  await requireAuthorizedUser();
  return <PropertyForm />;
}
