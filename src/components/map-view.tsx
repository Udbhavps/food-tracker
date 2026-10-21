"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { getEntry } from "@/lib/places/logic";
import type { LatLng } from "@/lib/places/geo";
import type { Place, State } from "@/lib/places/types";
import { STATUS_COLOR, STATUS_LABEL } from "./ui";

const BENGALURU: [number, number] = [12.9716, 77.5946];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function MapView({ places, state, me }: { places: Place[]; state: State; me?: LatLng | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true }).setView(BENGALURU, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      // Trigger a redraw of markers now that the map exists.
      el.current.dispatchEvent(new Event("map-ready"));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const node = el.current;
    let cancelled = false;
    const draw = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      const pts: [number, number][] = [];
      for (const p of places) {
        if (p.lat === null || p.lng === null) continue;
        const e = getEntry(state, p.id);
        pts.push([p.lat, p.lng]);
        L.circleMarker([p.lat, p.lng], {
          radius: 9,
          weight: 2,
          color: "#ffffff",
          fillColor: STATUS_COLOR[e.status],
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<strong>${esc(p.name)}</strong><br>${esc([p.area, p.category].filter(Boolean).join(" · "))}<br>` +
              `${esc(STATUS_LABEL[e.status])}<br><a href="/place?id=${encodeURIComponent(p.id)}">Open</a>`,
          )
          .addTo(layer.current);
      }
      if (me) {
        L.circleMarker([me.lat, me.lng], { radius: 8, weight: 3, color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 1 })
          .bindTooltip("You are here")
          .addTo(layer.current);
      }
      if (!fitted.current && pts.length > 0) {
        // Fit to places inside the city so two far-away saves don't zoom the map out to half of Karnataka.
        const near = pts.filter(([la, ln]) => la > 12.78 && la < 13.18 && ln > 77.4 && ln < 77.82);
        map.current.fitBounds(L.latLngBounds(near.length ? near : pts), { padding: [24, 24] });
        fitted.current = true;
      }
    };
    void draw();
    node?.addEventListener("map-ready", draw);
    return () => {
      cancelled = true;
      node?.removeEventListener("map-ready", draw);
    };
  }, [places, state, me]);

  return (
    <div
      ref={el}
      role="application"
      aria-label="Map of saved places"
      className="h-[calc(100dvh-14rem)] min-h-72 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
    />
  );
}
