import { describe, expect, it } from "vitest";
import { directionsUrl, formatDistance, haversineKm, inBengaluru, mapsSearchUrl } from "./geo";

describe("geo", () => {
  it("haversine is ~0 for the same point and roughly right for a known pair", () => {
    expect(haversineKm({ lat: 12.97, lng: 77.6 }, { lat: 12.97, lng: 77.6 })).toBe(0);
    // MG Road to Indiranagar 100ft road is about 4 km
    const d = haversineKm({ lat: 12.9756, lng: 77.6068 }, { lat: 12.9784, lng: 77.6408 });
    expect(d).toBeGreaterThan(3.3);
    expect(d).toBeLessThan(4.2);
  });
  it("formats distances", () => {
    expect(formatDistance(0.012)).toBe("50 m");
    expect(formatDistance(0.42)).toBe("400 m");
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(23.6)).toBe("24 km");
    expect(formatDistance(NaN)).toBe("");
  });
  it("builds encoded map links", () => {
    expect(directionsUrl({ lat: 12.9, lng: 77.5 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=12.9%2C77.5",
    );
    expect(mapsSearchUrl("A & B", "Ulsoor")).toContain("A%20%26%20B%20Ulsoor%20Bengaluru");
    expect(mapsSearchUrl("A", "", { lat: 1, lng: 2 })).toContain("query=1%2C2");
  });
  it("detects Bengaluru", () => {
    expect(inBengaluru({ lat: 12.97, lng: 77.6 })).toBe(true);
    expect(inBengaluru({ lat: 13.3, lng: 75.76 })).toBe(false);
  });
});
