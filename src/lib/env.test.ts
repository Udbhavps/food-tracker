import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a complete configuration", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("returns null when anything is missing, so the app can show setup help instead of crashing", () => {
    expect(parseEnv({})).toBeNull();
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBeNull();
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined })).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toBeNull();
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: "short" })).toBeNull();
  });
});
