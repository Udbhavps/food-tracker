import raw from "@/data/seed-places.json";
import { seedSchema, type Place } from "./types";

const parsed = seedSchema.parse(raw);

export const SEED_PLACES: Place[] = parsed.places;
export const SEED_CAPTURED_ON = parsed.capturedOn;
