import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseMode } from "@/lib/supabase/client";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // Already signed in & authorized -> go straight in.
  const user = await getSessionUser();
  if (user?.authorized) redirect(searchParams.next || "/dashboard");

  const next = searchParams.next || "/dashboard";

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          TaxSale <span className="text-accent">Copilot</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Private Ontario Tax Sale Underwriting</p>
      </div>
      <Card>
        {isSupabaseMode() ? (
          <>
            <GoogleSignIn next={next} />
            <p className="mt-4 text-center text-xs text-muted">
              Access is restricted to authorized accounts. There is no public sign-up.
            </p>
          </>
        ) : (
          <div className="text-center text-sm text-muted">
            <p className="mb-3 font-medium text-warn">Running in LOCAL mode (no authentication).</p>
            <p>
              Set <code className="text-text">NEXT_PUBLIC_APP_MODE=supabase</code> plus Supabase and
              Google credentials to enable sign-in. See <code>docs/SECURITY.md</code>.
            </p>
            <a href="/dashboard" className="mt-4 inline-block text-accent hover:underline">
              Continue to dashboard →
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
