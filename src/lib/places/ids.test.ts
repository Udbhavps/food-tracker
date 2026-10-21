import { describe, expect, it } from "vitest";
import { newId, todayLocal } from "./ids";

describe("ids", () => {
  it("makes distinct ids", () => {
    expect(newId()).not.toBe(newId());
  });
  it("formats the local date, padded", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
