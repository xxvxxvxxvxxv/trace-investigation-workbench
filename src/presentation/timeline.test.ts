import { describe, expect, it } from "vitest";
import { exactTime } from "../models/time";
import { elapsedLabel, timeLabel } from "./timeline";
describe("timeline presentation", () => {
  const a = exactTime("2026-08-01T09:00:00Z"),
    b = exactTime("2026-08-03T10:00:00Z");
  it("humanizes a 49-hour interval without claiming missing evidence", () =>
    expect(elapsedLabel(a, b)).toBe("2d 1h gap"));
  it("does not assert elapsed time from uncertain observations", () => {
    for (const qualifier of ["approximate", "before", "after", "date-only"] as const)
      expect(elapsedLabel({ ...a, qualifier }, b)).toBeUndefined();
    expect(elapsedLabel(b, a)).toBeUndefined();
  });
  it("labels every time qualifier and retains range boundaries", () => {
    expect(timeLabel({ ...a, qualifier: "approximate" })).toContain("Approximately");
    expect(timeLabel({ ...a, qualifier: "before" })).toContain("Before");
    expect(timeLabel({ ...a, qualifier: "after" })).toContain("After");
    expect(timeLabel({ ...a, qualifier: "date-only", precision: "day" })).toBe(
      "Date only · 2026-08-01",
    );
    expect(timeLabel({ ...a, qualifier: "range", end: b.start })).toContain(
      "→ 2026-08-03",
    );
    expect(timeLabel(a)).toContain("UTC");
  });
  it("measures from the end of a range", () =>
    expect(elapsedLabel({ ...a, qualifier: "range", end: b.start }, b)).toBeUndefined());
});
