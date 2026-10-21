import type { Status } from "@/lib/places/types";

export const STATUS_LABEL: Record<Status, string> = { want: "Want to try", visited: "Visited", skip: "Skip" };
export const STATUS_COLOR: Record<Status, string> = { want: "#ea580c", visited: "#16a34a", skip: "#71717a" };

export function StatusBadge({ status, favourite }: { status: Status; favourite?: boolean }) {
  const style =
    status === "visited"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : status === "skip"
        ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {STATUS_LABEL[status]}
      {favourite && <span aria-label="favourite">♥</span>}
    </span>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base dark:border-zinc-700";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium";
export const primaryButton = `${buttonClass} bg-orange-600 text-white hover:bg-orange-700`;
export const secondaryButton = `${buttonClass} border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900`;
