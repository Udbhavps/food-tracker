const R = 6371; // km

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Opens Google Maps search for the place (works without any API key). */
export function mapsSearchUrl(name: string, area: string, at?: LatLng | null): string {
  const q = encodeURIComponent([name, area, "Bengaluru"].filter(Boolean).join(" "));
  return at
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${at.lat},${at.lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${to.lat},${to.lng}`)}`;
}

/** Rough box around Bengaluru, used to flag coordinates that are probably wrong. */
export const BENGALURU_BOUNDS = { south: 12.78, north: 13.18, west: 77.4, east: 77.82 };

export function inBengaluru(p: LatLng): boolean {
  return p.lat >= BENGALURU_BOUNDS.south && p.lat <= BENGALURU_BOUNDS.north && p.lng >= BENGALURU_BOUNDS.west && p.lng <= BENGALURU_BOUNDS.east;
}
