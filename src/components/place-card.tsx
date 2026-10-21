import Link from "next/link";
import { formatDistance } from "@/lib/places/geo";
import type { Entry, Place } from "@/lib/places/types";
import { StatusBadge } from "./ui";

export function PlaceCard({ place, entry, km }: { place: Place; entry: Entry; km?: number }) {
  return (
    <li>
      <Link
        href={`/place?id=${encodeURIComponent(place.id)}`}
        className="flex min-h-16 items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{place.name}</p>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
            {[place.area, place.category, place.priceBand && `₹${place.priceBand.replace("₹", "")}`]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={entry.status} favourite={entry.favourite} />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {km !== undefined ? formatDistance(km) : place.rating !== null ? `★ ${place.rating.toFixed(1)}` : ""}
          </span>
        </div>
      </Link>
    </li>
  );
}
