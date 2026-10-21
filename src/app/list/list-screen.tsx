"use client";

import { useState } from "react";
import { PlaceCard } from "@/components/place-card";
import { Shell } from "@/components/shell";
import { inputClass, STATUS_LABEL } from "@/components/ui";
import { categoriesOf, filterPlaces, getEntry, noFilters, type Filters } from "@/lib/places/logic";
import { usePlaces } from "@/lib/places/store";
import { STATUSES, type Status } from "@/lib/places/types";

export function ListScreen() {
  const { places, state, hydrated } = usePlaces();
  const [f, setF] = useState<Filters>(noFilters);
  const shown = filterPlaces(places, state, f).sort((a, b) => a.name.localeCompare(b.name));
  const categories = categoriesOf(places);

  return (
    <Shell title="All places">
      <div className="flex flex-col gap-3">
        <input
          type="search"
          aria-label="Search places"
          placeholder="Search name, area or cuisine"
          className={inputClass}
          value={f.query}
          onChange={(e) => setF({ ...f, query: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Status"
            className={inputClass}
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value as Status | "all" })}
          >
            <option value="all">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Cuisine"
            className={inputClass}
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
          >
            <option value="">Any cuisine</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={f.favouritesOnly}
            onChange={(e) => setF({ ...f, favouritesOnly: e.target.checked })}
          />
          Favourites only
        </label>
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {hydrated ? `${shown.length} of ${places.length}` : "Loading…"}
        </p>
        {hydrated && shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No places match. Clear a filter or add a new place.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((p) => (
              <PlaceCard key={p.id} place={p} entry={getEntry(state, p.id)} />
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
