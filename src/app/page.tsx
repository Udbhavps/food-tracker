import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Food Tracker</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 rounded-lg px-3 text-sm text-zinc-600 underline dark:text-zinc-400">
            Sign out
          </button>
        </form>
      </header>
      {/* Reading the session uses cookies, so it must stream inside Suspense. */}
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <SignedInSummary />
      </Suspense>
    </main>
  );
}

async function SignedInSummary() {
  if (!getEnv()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <>
      <p>Signed in{profile?.display_name ? ` as ${profile.display_name}` : ""}.</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Phase 0 foundation is in place: sign-in, database and security rules. The map, places and visit log come in
        Phase 1.
      </p>
    </>
  );
}
