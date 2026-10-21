"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { buttonClass, inputClass, primaryButton, secondaryButton, STATUS_LABEL } from "@/components/ui";
import { directionsUrl, inBengaluru, mapsSearchUrl } from "@/lib/places/geo";
import { newId, todayLocal } from "@/lib/places/ids";
import {
  addVisit, averageVisitRating, getEntry, lastVisitDate, removeCustomPlace, removeVisit, setLocation, setNotes,
  setRecommendedBy, setStatus, toggleFavourite,
} from "@/lib/places/logic";
import { usePlaces } from "@/lib/places/store";
import { STATUSES } from "@/lib/places/types";

export function PlaceScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { places, state, update, hydrated } = usePlaces();
  const router = useRouter();
  const place = places.find((p) => p.id === id);

  if (!hydrated) return <Shell title="Place">{null}</Shell>;
  if (!place) {
    return (
      <Shell title="Place not found">
        <p className="mb-4">This place does not exist (it may have been deleted).</p>
        <Link href="/list" className={primaryButton}>
          Back to the list
        </Link>
      </Shell>
    );
  }

  const entry = getEntry(state, place.id);
  const at = place.lat !== null && place.lng !== null ? { lat: place.lat, lng: place.lng } : null;
  const avg = averageVisitRating(entry);
  const last = lastVisitDate(entry);
  const visits = [...entry.visits].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Shell title={place.name}>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>{[place.area, place.category, place.priceBand && `₹${place.priceBand.replace("₹", "")}`].filter(Boolean).join(" · ")}</p>
          {place.rating !== null && (
            <p>
              Google rating ★ {place.rating.toFixed(1)}
              {place.ratingCount !== null && ` (${place.ratingCount.toLocaleString("en-IN")} reviews)`}
            </p>
          )}
          {at && !inBengaluru(at) && <p>This place is outside Bengaluru.</p>}
          {last && (
            <p>
              Last visited {last}
              {avg !== null && ` · your average ★ ${avg.toFixed(1)}`}
            </p>
          )}
        </section>

        <section aria-labelledby="status-h" className="flex flex-col gap-2">
          <h2 id="status-h" className="font-medium">Status</h2>
          <div role="group" aria-label="Status" className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={entry.status === s}
                className={`${buttonClass} border ${
                  entry.status === s
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
                onClick={() => update((st) => setStatus(st, place.id, s))}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={entry.favourite}
            className={secondaryButton}
            onClick={() => update((st) => toggleFavourite(st, place.id))}
          >
            {entry.favourite ? "♥ Favourite" : "♡ Mark as favourite"}
          </button>
        </section>

        <section className="flex flex-wrap gap-2">
          {at ? (
            <a className={primaryButton} href={directionsUrl(at)} target="_blank" rel="noopener noreferrer">
              Directions
            </a>
          ) : null}
          <a
            className={secondaryButton}
            href={mapsSearchUrl(place.name, place.area, at)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps
          </a>
          {place.sourceUrls.map((u, i) => (
            <a key={u} className={secondaryButton} href={u} target="_blank" rel="noopener noreferrer">
              Instagram reel{place.sourceUrls.length > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
        </section>

        {!at && <LocationForm onSave={(p) => update((st) => setLocation(st, place.id, p))} />}

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Recommended by</h2>
          <input
            className={inputClass}
            aria-label="Recommended by"
            placeholder="e.g. Aman, a reel, a colleague"
            maxLength={120}
            defaultValue={entry.recommendedBy}
            onBlur={(e) => update((st) => setRecommendedBy(st, place.id, e.target.value))}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Notes</h2>
          <textarea
            aria-label="Notes"
            rows={4}
            maxLength={4000}
            className={`${inputClass} py-2`}
            placeholder="What to order, who to go with, parking…"
            defaultValue={entry.notes}
            onBlur={(e) => update((st) => setNotes(st, place.id, e.target.value))}
          />
        </section>

        <VisitForm onAdd={(v) => update((st) => addVisit(st, place.id, v, newId()))} />

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Visits ({visits.length})</h2>
          {visits.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No visits logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visits.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {v.date}
                      {v.rating !== null && <span className="ml-2 text-orange-600">{"★".repeat(v.rating)}</span>}
                    </p>
                    {v.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{v.note}</p>}
                  </div>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 px-2 text-sm text-red-600 underline"
                    aria-label={`Delete visit on ${v.date}`}
                    onClick={() => {
                      if (window.confirm("Delete this visit?")) update((st) => removeVisit(st, place.id, v.id));
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {place.source === "manual" && (
          <button
            type="button"
            className="min-h-11 self-start text-sm text-red-600 underline"
            onClick={() => {
              if (window.confirm(`Delete ${place.name} and all its visits?`)) {
                update((st) => removeCustomPlace(st, place.id));
                router.replace("/list");
              }
            }}
          >
            Delete this place
          </button>
        )}
      </div>
    </Shell>
  );
}

function VisitForm({ onAdd }: { onAdd: (v: { date: string; rating: number | null; note: string }) => void }) {
  const [date, setDate] = useState(todayLocal());
  const [rating, setRating] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        onAdd({ date, rating: rating ? Number(rating) : null, note: note.trim() });
        setNote("");
        setRating("");
      }}
    >
      <h2 className="font-medium">Log a visit</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input type="date" required className={inputClass} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Your rating
          <select className={inputClass} value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        What did you have?
        <textarea rows={2} maxLength={1000} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" className={primaryButton}>
        Save visit
      </button>
    </form>
  );
}

function LocationForm({ onSave }: { onSave: (p: { lat: number; lng: number }) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  function parse(): { lat: number; lng: number } | null {
    const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      onSubmit={(e) => {
        e.preventDefault();
        const p = parse();
        if (!p) return setError("Enter coordinates like 12.9716, 77.5946");
        setError("");
        onSave(p);
      }}
    >
      <h2 className="font-medium">Set the location</h2>
      <p className="text-sm">
        This place is not on the map yet. In Google Maps, long-press the spot (or right-click on desktop) and copy the
        coordinates shown, then paste them here.
      </p>
      <input className={inputClass} aria-label="Coordinates" inputMode="decimal" placeholder="12.9716, 77.5946" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className={primaryButton}>
        Save location
      </button>
    </form>
  );
}
