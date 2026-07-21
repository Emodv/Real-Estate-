import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Landing router: send authorized users to the dashboard, others to login. */
export default async function IndexPage() {
  const user = await getSessionUser();
  if (user?.authorized) redirect("/dashboard");
  redirect("/login");
}
