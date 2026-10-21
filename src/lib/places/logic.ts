import { entrySchema, STATE_VERSION, stateSchema, type Entry, type Place, type State, type Status } from "./types";
import { haversineKm, type LatLng } from "./geo";

export function emptyState(): State {
  return { version: STATE_VERSION, customPlaces: [], entries: {}, locations: {} };
}

/** Safe parse of whatever is in storage. Corrupt or unknown data yields an empty state, never a crash. */
export function parseState(raw: string | null): State {
  if (!raw) return emptyState();
  try {
    const result = stateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : emptyState();
  } catch {
    return emptyState();
  }
}

export function serializeState(state: State): string {
  return JSON.stringify(state);
}

export function defaultEntry(): Entry {
  return entrySchema.parse({});
}

export function getEntry(state: State, id: string): Entry {
  return state.entries[id] ?? defaultEntry();
}

/** Seed places + the user's own, with any user-set coordinates applied. Seed wins on id clashes. */
export function allPlaces(seed: Place[], state: State): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of [...seed, ...state.customPlaces]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const loc = state.locations[p.id];
    out.push(loc ? { ...p, lat: loc.lat, lng: loc.lng } : p);
  }
  return out;
}

function withEntry(state: State, id: string, change: (e: Entry) => Entry): State {
  return { ...state, entries: { ...state.entries, [id]: change(getEntry(state, id)) } };
}

export const setStatus = (s: State, id: string, status: Status) => withEntry(s, id, (e) => ({ ...e, status }));
export const toggleFavourite = (s: State, id: string) => withEntry(s, id, (e) => ({ ...e, favourite: !e.favourite }));
export const setNotes = (s: State, id: string, notes: string) => withEntry(s, id, (e) => ({ ...e, notes: notes.slice(0, 4000) }));
export const setRecommendedBy = (s: State, id: string, by: string) =>
  withEntry(s, id, (e) => ({ ...e, recommendedBy: by.trim().slice(0, 120) }));

export function addVisit(
  s: State,
  id: string,
  visit: { date: string; rating: number | null; note: string },
  newId: string,
): State {
  return withEntry(s, id, (e) => ({
    ...e,
    status: "visited",
    visits: [...e.visits, { id: newId, date: visit.date, rating: visit.rating, note: visit.note.slice(0, 1000) }],
  }));
}

export function removeVisit(s: State, id: string, visitId: string): State {
  return withEntry(s, id, (e) => ({ ...e, visits: e.visits.filter((v) => v.id !== visitId) }));
}

export function addCustomPlace(s: State, place: Place): State {
  return { ...s, customPlaces: [...s.customPlaces, place] };
}

export function removeCustomPlace(s: State, id: string): State {
  const { [id]: _entry, ...entries } = s.entries;
  const { [id]: _loc, ...locations } = s.locations;
  void _entry;
  void _loc;
  return { ...s, customPlaces: s.customPlaces.filter((p) => p.id !== id), entries, locations };
}

export function setLocation(s: State, id: string, at: LatLng): State {
  return { ...s, locations: { ...s.locations, [id]: { lat: at.lat, lng: at.lng } } };
}

export function lastVisitDate(e: Entry): string | null {
  return e.visits.reduce<string | null>((latest, v) => (latest === null || v.date > latest ? v.date : latest), null);
}

export function averageVisitRating(e: Entry): number | null {
  const rated = e.visits.filter((v) => v.rating !== null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, v) => sum + (v.rating ?? 0), 0) / rated.length;
}

export type Filters = {
  query: string;
  status: Status | "all";
  category: string; // "" = any
  favouritesOnly: boolean;
};

export const noFilters: Filters = { query: "", status: "all", category: "", favouritesOnly: false };

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterPlaces(places: Place[], state: State, f: Filters): Place[] {
  const q = norm(f.query.trim());
  return places.filter((p) => {
    const e = getEntry(state, p.id);
    if (f.status !== "all" && e.status !== f.status) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.favouritesOnly && !e.favourite) return false;
    if (q && !norm(`${p.name} ${p.area} ${p.category}`).includes(q)) return false;
    return true;
  });
}

export function categoriesOf(places: Place[]): string[] {
  return [...new Set(places.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export type WithDistance = { place: Place; km: number };

/** Places that have coordinates, nearest first, optionally limited to a radius. */
export function nearest(places: Place[], from: LatLng, maxKm = Infinity): WithDistance[] {
  const out: WithDistance[] = [];
  for (const place of places) {
    if (place.lat === null || place.lng === null) continue;
    const km = haversineKm(from, { lat: place.lat, lng: place.lng });
    if (km <= maxKm) out.push({ place, km });
  }
  return out.sort((a, b) => a.km - b.km);
}

export function stats(places: Place[], state: State) {
  let want = 0;
  let visited = 0;
  let favourites = 0;
  for (const p of places) {
    const e = getEntry(state, p.id);
    if (e.status === "want") want++;
    if (e.status === "visited") visited++;
    if (e.favourite) favourites++;
  }
  return { total: places.length, want, visited, favourites };
}

export function slugId(name: string, taken: Set<string>): string {
  const base = "u-" + (norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "place");
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}
