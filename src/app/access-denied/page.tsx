import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const user = await getSessionUser();
  // If somehow authorized, don't show the denial.
  if (user?.authorized) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Card>
        <h1 className="text-xl font-bold text-bad">Access Denied</h1>
        <p className="mt-3 text-sm text-muted">
          {user?.email ? (
            <>
              The account <span className="text-text">{user.email}</span> is not on the authorized
              list for this private tool.
            </>
          ) : (
            "You are not authorized to access this application."
          )}
        </p>
        <p className="mt-2 text-xs text-muted">
          Ask an administrator to add your email to <code>ALLOWED_EMAILS</code>.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="rounded-md border border-border bg-surface2 px-4 py-2 text-sm hover:bg-border">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
