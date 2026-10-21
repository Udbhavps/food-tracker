import { z } from "zod";

export const STATUSES = ["want", "visited", "skip"] as const;
export type Status = (typeof STATUSES)[number];

export const placeSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  area: z.string().max(120).default(""),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  category: z.string().max(60).default(""),
  rating: z.number().min(0).max(5).nullable().default(null),
  ratingCount: z.number().int().min(0).nullable().default(null),
  priceBand: z.string().max(40).default(""),
  source: z.enum(["maps", "instagram", "manual"]),
  sourceUrls: z.array(z.string().max(500)).max(20).default([]),
});
export type Place = z.infer<typeof placeSchema>;

export const seedSchema = z.object({
  version: z.number(),
  capturedOn: z.string(),
  note: z.string().optional(),
  places: z.array(placeSchema),
});

export const visitSchema = z.object({
  id: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  note: z.string().max(1000).default(""),
});
export type Visit = z.infer<typeof visitSchema>;

export const entrySchema = z.object({
  status: z.enum(STATUSES).default("want"),
  favourite: z.boolean().default(false),
  notes: z.string().max(4000).default(""),
  recommendedBy: z.string().max(120).default(""),
  visits: z.array(visitSchema).max(500).default([]),
});
export type Entry = z.infer<typeof entrySchema>;

export const STATE_VERSION = 1;

export const stateSchema = z.object({
  version: z.literal(STATE_VERSION),
  customPlaces: z.array(placeSchema).max(2000),
  entries: z.record(z.string(), entrySchema),
  /** Coordinates the user set for places that had none (or corrected). */
  locations: z.record(z.string(), z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })),
});
export type State = z.infer<typeof stateSchema>;
