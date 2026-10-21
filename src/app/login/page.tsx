import { Suspense } from "react";
import { getEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Food Tracker</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Where you ate, what to try, what is nearby.</p>
      </div>
      {/* searchParams is runtime data, so it is read inside Suspense. */}
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/");
  const configured = getEnv() !== null;

  return (
    <>
      {params.error && (
        <p role="alert" className="text-sm text-red-600">
          Sign-in did not complete. Please try again.
        </p>
      )}
      {configured ? (
        <LoginForm next={next} />
      ) : (
        <p role="alert" className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          The app is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill in the
          Supabase values (see README).
        </p>
      )}
    </>
  );
}
