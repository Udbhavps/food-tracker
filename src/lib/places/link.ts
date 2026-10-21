export type ParsedLink =
  | { kind: "maps"; url: string; name: string; lat: number | null; lng: number | null }
  | { kind: "maps-short"; url: string }
  | { kind: "instagram"; url: string }
  | { kind: "unknown" };

const validLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90;
const validLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180;

function safeUrl(text: string): URL | null {
  try {
    const u = new URL(text.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

const isGoogleHost = (h: string) => /^(www\.)?google\.(com|co\.[a-z]{2}|[a-z]{2,3})$/.test(h) || h === "maps.google.com";
export const SHORT_HOSTS = ["maps.app.goo.gl", "goo.gl"];

/** Pull coordinates from a Google Maps URL. Prefers the exact place pin (!3d..!4d..) over the map centre (@lat,lng). */
function coordsFrom(u: URL): { lat: number; lng: number } | null {
  const href = decodeURIComponent(u.pathname + u.search + u.hash);
  const pin = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const centre = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const q = (u.searchParams.get("q") ?? u.searchParams.get("query") ?? "").match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  for (const m of [pin, q, centre]) {
    if (m && validLat(Number(m[1])) && validLng(Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

export function parseLink(text: string): ParsedLink {
  const u = safeUrl(text);
  if (!u) return { kind: "unknown" };
  const host = u.hostname.toLowerCase();

  if (host === "instagram.com" || host === "www.instagram.com") {
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (m) return { kind: "instagram", url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/` };
    return { kind: "unknown" };
  }

  if (SHORT_HOSTS.includes(host)) return { kind: "maps-short", url: u.toString() };

  if (isGoogleHost(host) && (u.pathname.startsWith("/maps") || host === "maps.google.com")) {
    const place = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    let name = "";
    if (place) {
      try {
        name = decodeURIComponent(place[1].replace(/\+/g, " ")).trim();
      } catch {
        name = place[1].replace(/\+/g, " ");
      }
    } else {
      const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? "";
      if (!/^-?\d/.test(q)) name = q.trim();
    }
    const c = coordsFrom(u);
    return { kind: "maps", url: u.toString(), name: name.slice(0, 120), lat: c?.lat ?? null, lng: c?.lng ?? null };
  }
  return { kind: "unknown" };
}

/** Only these hosts may be fetched by the server when expanding a short link (prevents using it as an open proxy). */
export function isAllowedRedirectTarget(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return SHORT_HOSTS.includes(h) || h === "maps.google.com" || /^(www\.)?google\.(com|co\.[a-z]{2}|[a-z]{2,3})$/.test(h);
}
