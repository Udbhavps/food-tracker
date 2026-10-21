"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setStatus({ kind: "error", message: "Could not start Google sign-in. Please try again." });
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setStatus(error ? { kind: "error", message: "Could not send the link. Check the address and try again." } : { kind: "sent" });
  }

  const busy = status.kind === "sending";

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-sm text-zinc-500" aria-hidden="true">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /> or <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Email me a sign-in link
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={busy || email.trim() === ""}
          className="min-h-12 rounded-xl bg-orange-600 px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          Send link
        </button>
      </form>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {status.kind === "sent" && "Check your inbox for the sign-in link."}
        {status.kind === "error" && <span className="text-red-600">{status.message}</span>}
      </p>
    </div>
  );
}
