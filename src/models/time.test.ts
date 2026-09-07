import { describe, it, expect } from "vitest";
import { normalizeInstant, exactTime, validateTime, inputAsUTC } from "./time";
describe("investigation time", () => {
  it("normalizes offsets independently of the host timezone", () => {
    expect(normalizeInstant("2026-09-07T02:30:00+03:00")).toBe(
      "2026-09-06T23:30:00.000Z",
    );
    expect(normalizeInstant("2026-09-06T20:00:00-03:30")).toBe(
      "2026-09-06T23:30:00.000Z",
    );
    expect(inputAsUTC("2026-08-10T09:00")).toBe("2026-08-10T09:00:00.000Z");
  });
  it("rejects timezone-less instants, impossible dates, and invalid offsets", () => {
    for (const value of [
      "2026-09-07T12:00",
      "2026-02-30T12:00Z",
      "2026-13-01T12:00Z",
      "2026-01-01T24:00Z",
      "2026-01-01T12:00+15:00",
    ])
      expect(() => normalizeInstant(value)).toThrow();
  });
  it("compares normalized ranges across offset and date boundaries", () => {
    expect(exactTime("2026-09-07T01:00+03:00", "2026-09-06T23:00Z").end).toBe(
      "2026-09-06T23:00:00.000Z",
    );
    expect(() => exactTime("2026-09-07T01:00Z", "2026-09-07T02:00+03:00")).toThrow(
      "End time",
    );
  });
  it("supports precision, approximation, date-only and before/after metadata", () => {
    const start = normalizeInstant("2026-09-07T00:00Z");
    for (const qualifier of ["exact", "approximate", "before", "after"] as const)
      expect(() =>
        validateTime({ start, precision: "minute", qualifier, uncertaintyMs: 60000 }),
      ).not.toThrow();
    expect(() =>
      validateTime({ start, precision: "day", qualifier: "date-only" }),
    ).not.toThrow();
    expect(() => validateTime({ start, precision: "day", qualifier: "range" })).toThrow();
    expect(() =>
      validateTime({
        start,
        precision: "day",
        qualifier: "approximate",
        uncertaintyMs: -1,
      }),
    ).toThrow();
  });
});
