import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("allows normal in-app paths, including query strings", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/places/123?tab=visits")).toBe("/places/123?tab=visits");
  });

  it("falls back when missing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined, "/home")).toBe("/home");
    expect(safeNextPath("")).toBe("/");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/path",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/ok\\..\\evil",
    "/ok\nSet-Cookie: x=1",
  ])("rejects unsafe value %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
