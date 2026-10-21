import { describe, expect, it } from "vitest";
import { isAllowedRedirectTarget, parseLink } from "./link";

describe("parseLink", () => {
  it("reads name and exact pin from a full Maps place URL", () => {
    const r = parseLink("https://www.google.com/maps/place/Mangalore+Pearl/@12.9910,77.6190,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d12.990831!4d77.619286");
    expect(r).toMatchObject({ kind: "maps", name: "Mangalore Pearl", lat: 12.990831, lng: 77.619286 });
  });
  it("falls back to the map centre and decodes percent-encoding", () => {
    const r = parseLink("https://www.google.com/maps/place/Caf%C3%A9+Noir/@12.97,77.64,15z");
    expect(r).toMatchObject({ kind: "maps", name: "Café Noir", lat: 12.97, lng: 77.64 });
  });
  it("handles ?q=lat,lng and ?q=name", () => {
    expect(parseLink("https://maps.google.com/?q=12.9,77.5")).toMatchObject({ kind: "maps", name: "", lat: 12.9, lng: 77.5 });
    expect(parseLink("https://www.google.com/maps?q=Shokudo+Banaswadi")).toMatchObject({ kind: "maps", name: "Shokudo Banaswadi", lat: null });
  });
  it("rejects out-of-range coordinates", () => {
    expect(parseLink("https://maps.google.com/?q=999,999")).toMatchObject({ kind: "maps", lat: null, lng: null });
  });
  it("recognises short Maps links without fetching", () => {
    expect(parseLink("https://maps.app.goo.gl/AbC123")).toEqual({ kind: "maps-short", url: "https://maps.app.goo.gl/AbC123" });
  });
  it("normalises Instagram post and reel links, dropping tracking params", () => {
    expect(parseLink("https://www.instagram.com/reel/DeWtz_VJ7Id/?igsh=abc&utm_source=x")).toEqual({
      kind: "instagram", url: "https://www.instagram.com/reel/DeWtz_VJ7Id/",
    });
    expect(parseLink("https://instagram.com/p/DbgAdOdvjgE")).toEqual({ kind: "instagram", url: "https://www.instagram.com/p/DbgAdOdvjgE/" });
  });
  it.each(["", "hello", "javascript:alert(1)", "ftp://x.com", "https://evil.com/maps/place/X", "https://instagram.com.evil.com/p/abc/", "https://www.instagram.com/someone/"])(
    "treats %j as unknown", (t) => {
      expect(parseLink(t)).toEqual({ kind: "unknown" });
    });
});

describe("isAllowedRedirectTarget", () => {
  it.each([
    ["https://maps.app.goo.gl/x", true], ["https://www.google.com/maps/place/x", true], ["https://www.google.co.in/maps", true],
    ["http://maps.app.goo.gl/x", false], ["https://evil.com/", false], ["https://google.com.evil.com/", false],
    ["https://169.254.169.254/", false], ["https://localhost/", false],
  ])("%s -> %s", (u, ok) => {
    expect(isAllowedRedirectTarget(new URL(u))).toBe(ok);
  });
});
