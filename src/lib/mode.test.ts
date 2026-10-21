import { describe, expect, it } from "vitest";
import { parseMode } from "./mode";

describe("parseMode", () => {
  it("defaults to local so the app opens without sign-in", () => {
    expect(parseMode(undefined)).toBe("local");
    expect(parseMode("")).toBe("local");
    expect(parseMode("nonsense")).toBe("local");
  });
  it("only enables cloud mode when asked explicitly", () => {
    expect(parseMode("cloud")).toBe("cloud");
  });
});
