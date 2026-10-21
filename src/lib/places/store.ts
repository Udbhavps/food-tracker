"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { allPlaces, emptyState, parseState, serializeState } from "./logic";
import { SEED_PLACES } from "./seed";
import type { Place, State } from "./types";

const KEY = "food-tracker:v1";
const EMPTY: State = emptyState();

let cachedRaw: string | null | undefined;
let cached: State = EMPTY;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked (private mode etc.): app still works for this session
  }
}

let memoryOnly = false;

function getSnapshot(): State {
  if (memoryOnly) return cached;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseState(raw);
  }
  return cached;
}

function getServerSnapshot(): State {
  return EMPTY;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: State) {
  cached = next;
  const raw = serializeState(next);
  try {
    window.localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    memoryOnly = false;
  } catch {
    memoryOnly = true; // quota or blocked: keep working in memory
  }
  listeners.forEach((l) => l());
}

/** Test/maintenance helper: wipe everything stored in this browser. */
export function resetAll() {
  commit(emptyState());
}

export function exportJson(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

/** Replace data from an exported file. Returns false (and changes nothing) if the file is not valid. */
export function importJson(text: string): boolean {
  const next = parseState(text);
  // parseState returns empty for invalid input; treat that as failure unless the file really is an empty export.
  const looksEmpty = JSON.stringify(next) === JSON.stringify(emptyState());
  if (looksEmpty && !/"version"\s*:\s*1/.test(text)) return false;
  commit(next);
  return true;
}

export function usePlaces() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const places: Place[] = useMemo(() => allPlaces(SEED_PLACES, state), [state]);
  const update = useCallback((fn: (s: State) => State) => commit(fn(getSnapshot())), []);
  return { state, places, update, hydrated, memoryOnly };
}
