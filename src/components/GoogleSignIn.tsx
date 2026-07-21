"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Google OAuth sign-in button. Uses the browser Supabase client to start the
 * OAuth redirect flow; the code is exchanged for a session in
 * /auth/callback. No secrets touch the client — only the public anon key.
 */
export function GoogleSignIn({ next = "/dashboard" }: { next?: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setBusy(false);
      return;
    }
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser is redirected to Google.
  }

  return (
    <div className="w-full">
      <button
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        <GoogleIcon />
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && <p className="mt-3 text-xs text-bad">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
