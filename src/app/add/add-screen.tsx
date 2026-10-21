"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Shell } from "@/components/shell";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { addCustomPlace, setStatus, slugId } from "@/lib/places/logic";
import { exportJson, importJson, usePlaces } from "@/lib/places/store";
import { parseLink } from "@/lib/places/link";
import { placeSchema, type Status } from "@/lib/places/types";

export function AddScreen() {
  const { places, update, memoryOnly } = usePlaces();
  const router = useRouter();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [coords, setCoords] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatusValue] = useState<Status>("want");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function applyMaps(p: { name: string; lat: number | null; lng: number | null }) {
    if (p.name) setName(p.name);
    if (p.lat !== null && p.lng !== null) setCoords(`${p.lat}, ${p.lng}`);
    setLinkMsg(
      p.lat === null
        ? "Got the name but no exact location from this link. You can add coordinates below."
        : "Filled in the name and location. Check them, then add the place.",
    );
  }

  async function readLink() {
    setLinkMsg("");
    const r = parseLink(pasted);
    if (r.kind === "instagram") {
      setLink(r.url);
      setLinkMsg("Saved the reel link. Instagram does not share the place name, so type it below.");
    } else if (r.kind === "maps") {
      applyMaps(r);
    } else if (r.kind === "maps-short") {
      setBusy(true);
      try {
        const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(r.url)}`);
        const data: { url?: string } = await res.json();
        const full = data.url ? parseLink(data.url) : null;
        if (full?.kind === "maps") applyMaps(full);
        else setLinkMsg("Could not open that short link. Open it in Google Maps, tap Share, and paste the longer link instead.");
      } catch {
        setLinkMsg("Could not open that short link. Check your connection or paste the longer link.");
      } finally {
        setBusy(false);
      }
    } else {
      setLinkMsg("That does not look like a Google Maps or Instagram post/reel link.");
    }
  }

  const clash = name.trim() && places.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let lat: number | null = null;
    let lng: number | null = null;
    if (coords.trim()) {
      const m = coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) return setError("Coordinates should look like 12.9716, 77.5946 (or leave blank).");
      lat = Number(m[1]);
      lng = Number(m[2]);
    }
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) return setError("The link must start with http:// or https://");
    const id = slugId(name, new Set(places.map((p) => p.id)));
    const parsed = placeSchema.safeParse({
      id, name, area: area.trim(), lat, lng, category: category.trim(), rating: null, ratingCount: null,
      priceBand: "", source: "manual", sourceUrls: link.trim() ? [link.trim()] : [],
    });
    if (!parsed.success) return setError("Please check the details: a name is required and coordinates must be valid.");
    update((s) => setStatus(addCustomPlace(s, parsed.data), id, status));
    router.push(`/place?id=${encodeURIComponent(id)}`);
  }

  function download() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `food-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) return setMessage("That file is too large to be a backup.");
    const ok = importJson(await f.text());
    setMessage(ok ? "Backup restored." : "That file is not a valid Food Tracker backup. Nothing was changed.");
    if (file.current) file.current.value = "";
  }

  return (
    <Shell title="Add a place">
      <section className="mb-6 flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Paste a link
          <input
            className={inputClass}
            inputMode="url"
            placeholder="Google Maps or Instagram link"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
        </label>
        <button type="button" className={secondaryButton} onClick={() => void readLink()} disabled={busy || !pasted.trim()}>
          {busy ? "Reading…" : "Fill in from link"}
        </button>
        {linkMsg && <p role="status" className="text-sm">{linkMsg}</p>}
      </section>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input required maxLength={120} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {clash && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">A place with this name is already saved. Add it anyway only if it is a different outlet.</p>}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Area
            <input maxLength={120} className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Indiranagar" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Cuisine
            <input maxLength={60} className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Biryani" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Coordinates (optional)
          <input className={inputClass} inputMode="decimal" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="12.9716, 77.5946" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Link, e.g. the Instagram reel (optional)
          <input type="url" maxLength={500} className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/p/…" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select className={inputClass} value={status} onChange={(e) => setStatusValue(e.target.value as Status)}>
            <option value="want">Want to try</option>
            <option value="visited">Already visited</option>
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" className={primaryButton}>Add place</button>
      </form>

      <section className="mt-10 flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="font-medium">Your data</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Right now everything is saved only in this browser on this device. Download a backup now and then. Syncing
          across devices and sharing with friends comes with sign-in in a later phase.
        </p>
        {memoryOnly && (
          <p role="alert" className="text-sm text-red-600">
            This browser is blocking storage, so changes will be lost when you close the tab. Download a backup.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} onClick={download}>Download backup</button>
          <button type="button" className={secondaryButton} onClick={() => file.current?.click()}>Restore backup</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} />
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
      </section>
    </Shell>
  );
}
