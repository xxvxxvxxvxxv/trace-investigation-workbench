import { describe, it, expect } from "vitest";
import { draftToValues, valuesToDraft } from "./records";
import { exactTime } from "../models/time";
import type { Values } from "../models/schema";
describe("presentation boundary", () => {
  it("round-trips structured values without degrading numeric and boolean attributes", () => {
    const base: Values = {
      tags: ["a", "b"],
      aliases: ["relay"],
      attributes: { count: 3, verified: true },
      favorite: false,
    };
    expect(draftToValues("entities", valuesToDraft(base), base)).toEqual(base);
  });
  it("preserves uncertain time metadata when changing unrelated fields", () => {
    const base: Values = {
      time: {
        ...exactTime("2026-09-07T12:00Z"),
        qualifier: "approximate",
        uncertaintyMs: 60000,
      },
      description: "Old",
    };
    const updated = draftToValues(
      "timeline",
      { ...valuesToDraft(base), description: "New" },
      base,
    );
    expect(updated.time).toEqual(base.time);
    expect(updated.description).toBe("New");
  });
  it("normalizes explicit UTC controls and parses numerical and boolean values", () => {
    expect(
      draftToValues("locations", { latitude: "0", longitude: "-1.5" }),
    ).toMatchObject({ latitude: 0, longitude: -1.5 });
    expect(draftToValues("tools", { favorite: "yes" }).favorite).toBe(true);
    expect(draftToValues("timeline", { timestamp: "2026-09-07T12:00" }).time!.start).toBe(
      "2026-09-07T12:00:00.000Z",
    );
  });
});
