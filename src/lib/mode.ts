/**
 * "local" (default): the app opens straight away and keeps data in this browser only.
 * "cloud": sign-in is required and data lives in Supabase (wired up in a later phase).
 */
export type AppMode = "local" | "cloud";

export function parseMode(value: string | undefined): AppMode {
  return value === "cloud" ? "cloud" : "local";
}

export function getMode(): AppMode {
  return parseMode(process.env.NEXT_PUBLIC_APP_MODE);
}
