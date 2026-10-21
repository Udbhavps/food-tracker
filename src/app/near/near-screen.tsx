"use client";

import { useState } from "react";
import { PlaceCard } from "@/components/place-card";
import { Shell } from "@/components/shell";
import { inputClass, primaryButton } from "@/components/ui";
import type { LatLng } from "@/lib/places/geo";
import { getEntry, nearest } from "@/lib/places/logic";
import { usePlaces } from "@/lib/places/store";

type Geo = { kind: "idle" } | { kind: "asking" } | { kind: "ok"; at: LatLng } | { kind: "error"; message: string };

const RADII = [2, 5, 10, 25];

export function NearScreen() {
  const { places, state } = usePlaces();
  const [geo, setGeo] = useState<Geo>({ kind: "idle" });
  const [radius, setRadius] = useState(5);
  const [hideVisited, setHideVisited] = useState(true);

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "error", message: "This browser cannot share your location." });
      return;
    }
    setGeo({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ kind: "ok", at: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (err) =>
        setGeo({
          kind: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow it in your browser settings and try again."
              : "Could not get your location. Try again outside or with better signal.",
        }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  const results =
    geo.kind === "ok"
      ? nearest(places, geo.at, radius).filter((r) => {
          const e = getEntry(state, r.place.id);
          return e.status !== "skip" && (!hideVisited || e.status !== "visited");
        })
      : [];

  return (
    <Shell title="Near me">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Uses your phone&apos;s location only on this screen, only when you tap the button. It is not stored or sent
          anywhere.
        </p>
        <button type="button" className={primaryButton} onClick={locate} disabled={geo.kind === "asking"}>
          {geo.kind === "asking" ? "Finding you…" : geo.kind === "ok" ? "Update my location" : "Find places near me"}
        </button>
        {geo.kind === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {geo.message}
          </p>
        )}
        {geo.kind === "ok" && (
          <>
            <div className="grid grid-cols-2 items-center gap-2">
              <select
                aria-label="Distance"
                className={inputClass}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    Within {r} km
                  </option>
                ))}
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={hideVisited}
                  onChange={(e) => setHideVisited(e.target.checked)}
                />
                Hide visited
              </label>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
              {results.length} nearby
            </p>
            {results.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                Nothing saved within {radius} km. Try a wider distance.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((r) => (
                  <PlaceCard key={r.place.id} place={r.place} entry={getEntry(state, r.place.id)} km={r.km} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
