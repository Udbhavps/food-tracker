import { describe, expect, it } from "vitest";
import { SEED_PLACES } from "./seed";
import { inBengaluru } from "./geo";

// These two are real saved places outside the city (Kanakapura road, and a hotel near Chikkamagaluru).
const OUTSIDE_CITY = new Set(["m-rajesh-biryani-hotel", "m-balu-hallimane-hotel"]);

describe("seed data integrity", () => {
  it("has unique ids and names that are not blank", () => {
    const ids = SEED_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SEED_PLACES) expect(p.name.trim()).not.toBe("");
  });
  it("has 48 Maps places with coordinates", () => {
    const maps = SEED_PLACES.filter((p) => p.source === "maps");
    expect(maps).toHaveLength(48);
    for (const p of maps) {
      expect(p.lat, p.name).not.toBeNull();
      expect(p.lng, p.name).not.toBeNull();
    }
  });
  it("keeps every place with coordinates inside Bengaluru, except the known outliers", () => {
    for (const p of SEED_PLACES) {
      if (p.lat === null || p.lng === null) continue;
      const inside = inBengaluru({ lat: p.lat, lng: p.lng });
      expect(inside, p.name).toBe(!OUTSIDE_CITY.has(p.id));
    }
  });
  it("has sane ratings and Instagram links", () => {
    for (const p of SEED_PLACES) {
      if (p.rating !== null) expect(p.rating).toBeGreaterThanOrEqual(1);
      for (const u of p.sourceUrls) expect(u).toMatch(/^https:\/\/www\.instagram\.com\//);
    }
  });
});
