import { exactTime, nowUTC } from "../models/time";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, deleteRecord, saveRecord } from "./database";
import { seed } from "../data/seed";
import { createBackup, importBackup, validateBackup, csv } from "../utils/backup";
beforeEach(async () => {
  await db.open();
  for (const table of db.tables) await table.clear();
});
describe("local investigation integrity", () => {
  it("seeds once with exactly the requested fictional demo records", async () => {
    await seed();
    await seed();
    const counts = await Promise.all(
      [
        "cases",
        "entities",
        "evidence",
        "timeline",
        "locations",
        "hypotheses",
        "gaps",
        "leads",
      ].map((k) => db.records.where("kind").equals(k).count()),
    );
    expect(counts).toEqual([1, 3, 4, 4, 2, 1, 1, 1]);
    expect(await db.records.where("kind").equals("tools").count()).toBe(20);
  });
  it("allocates unique sequential evidence IDs per case under concurrent writes", async () => {
    const c = await saveRecord("cases", "", "Case A", {});
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => saveRecord("evidence", c.id, `Item ${i}`, {})),
    );
    expect(results.map((r) => r.code)).toEqual(["E001", "E002", "E003", "E004", "E005"]);
    const b = await saveRecord("cases", "", "Case B", {});
    expect((await saveRecord("evidence", b.id, "Other", {})).code).toBe("E001");
  });
  it("round-trips a database and continues counters without collisions", async () => {
    await seed();
    const backup = await createBackup();
    validateBackup(backup);
    for (const table of db.tables) await table.clear();
    await importBackup(backup);
    expect(await db.records.count()).toBe(backup.records.length);
    const c = backup.records.find((r) => r.kind === "cases")!;
    expect((await saveRecord("evidence", c.id, "New item", {})).code).toBe("E005");
    await expect(importBackup(backup)).rejects.toThrow("overlaps");
  });
  it("rejects malformed references and unsafe links before mutation", async () => {
    await seed();
    const b = await createBackup();
    b.relationships[0].to = crypto.randomUUID();
    expect(() => validateBackup(b)).toThrow("missing or unrelated");
    const b2 = await createBackup();
    b2.records.find((r) => r.kind === "tools")!.values.url = "javascript:alert(1)";
    expect(() => validateBackup(b2)).toThrow("Unsafe URL");
  });
  it("removes incoming links, relationships, and attachments on deletion", async () => {
    await seed();
    const entity = await db.records.where("kind").equals("entities").first();
    await deleteRecord(entity!);
    expect(
      await db.relationships
        .filter((r) => r.from === entity!.id || r.to === entity!.id)
        .count(),
    ).toBe(0);
    expect(
      (await db.records.toArray()).some((r) =>
        JSON.stringify(r.values).includes(entity!.id),
      ),
    ).toBe(false);
    validateBackup(await createBackup());
  });
  it("exports isolated cases and neutralizes CSV formula cells", async () => {
    await seed();
    const c = await db.records.where("kind").equals("cases").first();
    const b = await createBackup(c!.id);
    expect(b.records.some((r) => r.kind === "tools")).toBe(false);
    validateBackup(b);
    const r = await saveRecord("evidence", c!.id, '=HYPERLINK("bad")', {});
    expect(csv([r], "evidence")).toContain("'=HYPERLINK");
  });
  it("preserves attachment bytes and rejects tampered backup content", async () => {
    const c = await saveRecord("cases", "", "Case", {});
    const r = await saveRecord("evidence", c.id, "File", {});
    const blob = new Blob(["synthetic evidence"], { type: "text/plain" });
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await db.attachments.add({
      id: crypto.randomUUID(),
      recordId: r.id,
      caseId: c.id,
      name: "sample.txt",
      mime: "text/plain",
      size: blob.size,
      sha256: hash,
      createdAt: nowUTC(),
      blob,
    });
    const backup = await createBackup();
    for (const table of db.tables) await table.clear();
    await importBackup(backup);
    expect(await (await db.attachments.toArray())[0].blob.text()).toBe(
      "synthetic evidence",
    );
    const corrupted = structuredClone(backup);
    corrupted.attachments[0].sha256 = "0".repeat(64);
    await expect(importBackup(corrupted)).rejects.toThrow("checksum");
  });
  it("rejects invalid coordinates and reverse time intervals", async () => {
    const c = await saveRecord("cases", "", "Case", {});
    await expect(
      saveRecord("locations", c.id, "Bad", { latitude: 91, longitude: 0 }),
    ).rejects.toThrow("Coordinates");
    await expect(
      saveRecord("timeline", c.id, "Bad", {
        time: {
          ...exactTime("2026-09-07T12:00Z"),
          end: exactTime("2026-09-06T12:00Z").start,
        },
      }),
    ).rejects.toThrow("End time");
  });
});
