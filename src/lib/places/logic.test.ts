import { describe, expect, it } from "vitest";
import {
  addCustomPlace, addVisit, allPlaces, averageVisitRating, categoriesOf, emptyState, filterPlaces, getEntry,
  lastVisitDate, nearest, noFilters, parseState, removeCustomPlace, removeVisit, serializeState, setLocation,
  setNotes, setStatus, slugId, stats, toggleFavourite,
} from "./logic";
import type { Place } from "./types";

const mk = (id: string, name: string, over: Partial<Place> = {}): Place => ({
  id, name, area: "", lat: 12.97, lng: 77.6, category: "Cafe", rating: null, ratingCount: null, priceBand: "",
  source: "maps", sourceUrls: [], ...over,
});
const A = mk("a", "Café Ünique", { area: "Indiranagar", category: "Cafe" });
const B = mk("b", "Biryani House", { category: "Biryani", lat: 13.0, lng: 77.7 });
const C = mk("c", "No Location", { lat: null, lng: null, source: "instagram" });

describe("state persistence", () => {
  it("round-trips", () => {
    const s = setNotes(setStatus(emptyState(), "a", "visited"), "a", "great");
    expect(parseState(serializeState(s))).toEqual(s);
  });
  it.each([null, "", "not json", "{}", '{"version":99}', '{"version":1,"customPlaces":"x"}'])(
    "falls back to empty for bad data %j", (raw) => {
      expect(parseState(raw)).toEqual(emptyState());
    });
  it("rejects out-of-range coordinates in stored data", () => {
    const bad = { ...emptyState(), locations: { a: { lat: 999, lng: 0 } } };
    expect(parseState(JSON.stringify(bad))).toEqual(emptyState());
  });
});

describe("entries", () => {
  it("defaults to want-to-try and does not mutate the previous state", () => {
    const s0 = emptyState();
    const s1 = setStatus(s0, "a", "skip");
    expect(getEntry(s0, "a").status).toBe("want");
    expect(getEntry(s1, "a").status).toBe("skip");
    expect(s0.entries).toEqual({});
  });
  it("logging a visit marks the place visited and keeps history", () => {
    let s = addVisit(emptyState(), "a", { date: "2026-10-01", rating: 4, note: "ok" }, "v1");
    s = addVisit(s, "a", { date: "2026-10-15", rating: 5, note: "better" }, "v2");
    const e = getEntry(s, "a");
    expect(e.status).toBe("visited");
    expect(e.visits).toHaveLength(2);
    expect(lastVisitDate(e)).toBe("2026-10-15");
    expect(averageVisitRating(e)).toBe(4.5);
    expect(getEntry(removeVisit(s, "a", "v1"), "a").visits.map((v) => v.id)).toEqual(["v2"]);
  });
  it("average rating ignores unrated visits", () => {
    const s = addVisit(emptyState(), "a", { date: "2026-10-01", rating: null, note: "" }, "v1");
    expect(averageVisitRating(getEntry(s, "a"))).toBeNull();
  });
  it("toggles favourite", () => {
    const s = toggleFavourite(emptyState(), "a");
    expect(getEntry(s, "a").favourite).toBe(true);
    expect(getEntry(toggleFavourite(s, "a"), "a").favourite).toBe(false);
  });
});

describe("places", () => {
  it("applies user-set locations and lets seed win on id clashes", () => {
    const s = setLocation(emptyState(), "c", { lat: 13.01, lng: 77.64 });
    const out = allPlaces([A, C], addCustomPlace(s, mk("a", "Impostor")));
    expect(out.map((p) => p.name)).toEqual(["Café Ünique", "No Location"]);
    expect(out[1]).toMatchObject({ lat: 13.01, lng: 77.64 });
  });
  it("removing a custom place also removes its data", () => {
    let s = addCustomPlace(emptyState(), mk("u-x", "X"));
    s = setNotes(setLocation(s, "u-x", { lat: 1, lng: 2 }), "u-x", "n");
    s = removeCustomPlace(s, "u-x");
    expect(s).toEqual(emptyState());
  });
  it("makes unique ids", () => {
    expect(slugId("Café Ünique!", new Set())).toBe("u-cafe-unique");
    expect(slugId("Café Ünique!", new Set(["u-cafe-unique"]))).toBe("u-cafe-unique-2");
    expect(slugId("!!!", new Set())).toBe("u-place");
  });
});

describe("filtering", () => {
  const places = [A, B, C];
  it("searches name and area ignoring case and accents", () => {
    expect(filterPlaces(places, emptyState(), { ...noFilters, query: "cafe unique" })).toEqual([A]);
    expect(filterPlaces(places, emptyState(), { ...noFilters, query: "INDIRA" })).toEqual([A]);
  });
  it("filters by status, category and favourites", () => {
    let s = setStatus(emptyState(), "b", "visited");
    s = toggleFavourite(s, "a");
    expect(filterPlaces(places, s, { ...noFilters, status: "visited" })).toEqual([B]);
    expect(filterPlaces(places, s, { ...noFilters, category: "Cafe" })).toEqual([A, C]);
    expect(filterPlaces(places, s, { ...noFilters, favouritesOnly: true })).toEqual([A]);
  });
  it("lists categories once, sorted", () => {
    expect(categoriesOf(places)).toEqual(["Biryani", "Cafe"]);
  });
  it("counts stats", () => {
    const s = toggleFavourite(setStatus(emptyState(), "a", "visited"), "b");
    expect(stats(places, s)).toEqual({ total: 3, want: 2, visited: 1, favourites: 1 });
  });
});

describe("nearest", () => {
  it("sorts by distance, skips places without coordinates, respects radius", () => {
    const here = { lat: 12.97, lng: 77.6 };
    const out = nearest([B, A, C], here);
    expect(out.map((x) => x.place.id)).toEqual(["a", "b"]);
    expect(out[0].km).toBeCloseTo(0, 5);
    expect(nearest([A, B], here, 5).map((x) => x.place.id)).toEqual(["a"]);
  });
});
