"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Legend } from "@/components/legend";
import { Shell } from "@/components/shell";
import { filterPlaces, noFilters, stats } from "@/lib/places/logic";
import { usePlaces } from "@/lib/places/store";
import { STATUSES, type Status } from "@/lib/places/types";
import { STATUS_LABEL, inputClass } from "@/components/ui";

const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />,
});

export function MapScreen() {
  const { places, state, hydrated } = usePlaces();
  const [status, setStatus] = useState<Status | "all">("all");
  const shown = filterPlaces(places, state, { ...noFilters, status });
  const s = stats(places, state);
  const unplaced = shown.filter((p) => p.lat === null).length;

  return (
    <Shell title="Food Tracker" wide>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {hydrated ? `${s.total} places · ${s.visited} visited · ${s.want} to try` : "Loading…"}
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Show
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "all")}
          >
            <option value="all">Everything</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </select>
        </label>
        <MapView places={shown} state={state} />
        <Legend />
        {unplaced > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {unplaced} place{unplaced === 1 ? " has" : "s have"} no location yet, so {unplaced === 1 ? "it is" : "they are"} not on the
            map. Open it from the List tab and set a location.
          </p>
        )}
      </div>
    </Shell>
  );
}
