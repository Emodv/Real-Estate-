import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "TaxSale Copilot",
  description:
    "Internal investment intelligence for Ontario municipal tax-sale properties (BRRRR underwriting).",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.NEXT_PUBLIC_APP_MODE ?? "local";
  const user = await getSessionUser();
  const signedIn = !!user?.authorized;
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href={signedIn ? "/dashboard" : "/login"} className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight">
                TaxSale <span className="text-accent">Copilot</span>
              </span>
              <span className="rounded bg-surface2 px-2 py-0.5 text-xs text-muted">
                Ontario · BRRRR
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {signedIn && (
                <>
                  <Link href="/dashboard" className="text-muted hover:text-text">
                    Dashboard
                  </Link>
                  <Link
                    href="/properties/new"
                    className="rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90"
                  >
                    + New property
                  </Link>
                </>
              )}
              {mode === "local" && (
                <span
                  title="Running without Supabase/Auth. Set NEXT_PUBLIC_APP_MODE=supabase for full mode."
                  className="rounded bg-warn/20 px-2 py-0.5 text-xs text-warn"
                >
                  LOCAL MODE
                </span>
              )}
              {signedIn && mode !== "local" && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted" title={user?.email ?? undefined}>
                    {user?.email}
                  </span>
                  <form action="/auth/signout" method="post">
                    <button className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-bad hover:text-bad">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-muted">
          Internal decision-support tool. Every figure is an estimate unless marked
          VERIFIED. The system recommends; the human decides. Never bids automatically.
        </footer>
      </body>
    </html>
  );
}
