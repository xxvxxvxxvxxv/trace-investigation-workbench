import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  db,
  saveRecord,
  saveRelationship,
  deleteRelationship,
  deleteRecord,
  incomingRelationships,
  outgoingRelationships,
  relationshipsByType,
  linkedRecords,
} from "./database";
import type { LinkSelection } from "../models/schema";
import { createBackup, importBackup, validateBackup, type Backup } from "../utils/backup";
import { legacyFixture } from "./migrations/legacyFixture";
import { nowUTC } from "../models/time";
beforeEach(async () => {
  await db.open();
  for (const table of db.tables) await table.clear();
});
async function setup() {
  const c = await saveRecord("cases", "", "Fictional case", {});
  const e = await saveRecord("evidence", c.id, "Fictional evidence", {});
  const h = await saveRecord("hypotheses", c.id, "Fictional hypothesis", {});
  return { c, e, h };
}
describe("authoritative relationships", () => {
  it("writes form links to the same model queried by graph and provenance helpers", async () => {
    const { c, e, h } = await setup();
    await saveRecord("hypotheses", c.id, h.title, h.values, h, { supporting: [e.id] });
    const relations = await incomingRelationships(h.id);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ from: e.id, to: h.id, type: "SUPPORTS" });
    expect(await outgoingRelationships(e.id)).toEqual(relations);
    expect(await relationshipsByType(c.id, "SUPPORTS")).toEqual(relations);
    expect((await linkedRecords(h.id)).map((r) => r.id)).toEqual([e.id]);
    expect((await db.records.get(h.id))!.values.supporting).toBeUndefined();
  });
  it("rejects duplicate identical relations even under concurrent creation", async () => {
    const { c, e, h } = await setup();
    const draft = { caseId: c.id, from: e.id, to: h.id, type: "SUPPORTS" };
    const results = await Promise.allSettled([
      saveRelationship(draft),
      saveRelationship(draft),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.relationships.count()).toBe(1);
  });
  it("preserves optional relation metadata when saving the same form selection", async () => {
    const { c, e, h } = await setup();
    const source = await saveRecord("sources", c.id, "Source", {});
    const relation = await saveRelationship({
      caseId: c.id,
      from: e.id,
      to: h.id,
      type: "SUPPORTS",
      notes: "Independent observation",
      confidence: "high",
      sourceId: source.id,
      supportingEvidenceIds: [e.id],
      provenance: { url: "https://example.com/" },
    });
    await saveRecord("hypotheses", c.id, h.title, h.values, h, { supporting: [e.id] });
    expect(await db.relationships.get(relation.id)).toEqual(relation);
    await deleteRecord(source);
    expect((await db.relationships.get(relation.id))!.sourceId).toBeUndefined();
    validateBackup(await createBackup());
  });
  it("makes graph deletion immediately visible to form projections", async () => {
    const { c, e, h } = await setup();
    const relation = await saveRelationship({
      caseId: c.id,
      from: e.id,
      to: h.id,
      type: "SUPPORTS",
    });
    await deleteRelationship(relation.id);
    expect(await linkedRecords(h.id)).toHaveLength(0);
  });
  it("rejects missing endpoints, cross-case references, wrong semantics, and malformed arrays atomically", async () => {
    const { c, e, h } = await setup();
    const other = await saveRecord("cases", c.id, "Other case", {});
    const foreign = await saveRecord("entities", other.id, "Other entity", {});
    for (const draft of [
      { caseId: c.id, from: e.id, to: crypto.randomUUID(), type: "USES" },
      { caseId: c.id, from: e.id, to: foreign.id, type: "USES" },
      { caseId: c.id, from: h.id, to: e.id, type: "SUPPORTS" },
    ])
      await expect(saveRelationship(draft)).rejects.toThrow();
    const before = await db.activity.count();
    await expect(
      saveRecord("hypotheses", c.id, h.title, h.values, h, {
        supporting: e.id,
      } as unknown as LinkSelection),
    ).rejects.toThrow("structured link array");
    expect(await db.relationships.count()).toBe(0);
    expect(await db.activity.count()).toBe(before);
  });
  it("allocates case codes globally regardless of active case, with concurrent writes", async () => {
    const initial = await saveRecord("cases", "", "First", {});
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        saveRecord("cases", i % 2 ? initial.id : "", "Case " + i, {}),
      ),
    );
    expect(created.map((c) => c.code)).toEqual([
      "CASE002",
      "CASE003",
      "CASE004",
      "CASE005",
      "CASE006",
      "CASE007",
    ]);
  });
});
describe("v2 backup and import boundaries", () => {
  it("round-trips structured values, relations, counters and schema metadata", async () => {
    const { c, e, h } = await setup();
    await saveRelationship({
      caseId: c.id,
      from: e.id,
      to: h.id,
      type: "SUPPORTS",
      supportingEvidenceIds: [e.id],
    });
    const entity = await saveRecord("entities", c.id, "Entity", {
      tags: ["demo"],
      aliases: ["A", "B"],
      attributes: { count: 2, verified: false },
    });
    const removed = await saveRecord("evidence", c.id, "Removed", {});
    await deleteRecord(removed);
    const backup = await createBackup();
    expect(backup).toMatchObject({
      version: 2,
      schemaVersion: 2,
      applicationVersion: "0.2.1-beta",
    });
    for (const table of db.tables) await table.clear();
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.records.get(entity.id)).toEqual(entity);
    expect((await saveRecord("evidence", c.id, "Next", {})).code).toBe("E003");
  });
  it("imports v1 JSON through the same lossless migration path", async () => {
    const f = legacyFixture();
    await importBackup({
      format: "TRACE",
      version: 1,
      scope: "database",
      exportedAt: nowUTC(),
      records: f.records,
      relationships: f.relationships,
      attachments: [],
      activity: [],
    });
    expect((await db.records.get(f.ev))!.values.time!.start).toBe(
      "2026-08-10T09:00:00.000Z",
    );
    expect(await db.relationships.where("type").equals("SUPPORTS").count()).toBe(1);
    expect((await createBackup()).migrationHistory).toHaveLength(1);
  });
  it("rejects activity ID collision before any imported records are committed", async () => {
    await setup();
    const backup = await createBackup();
    for (const table of db.tables) await table.clear();
    const collision = { ...backup.activity[0], caseId: "", description: "Keep me" };
    await db.activity.add(collision);
    await expect(importBackup(backup)).rejects.toThrow("Activity ID collision");
    expect(await db.records.count()).toBe(0);
    expect(await db.activity.get(collision.id)).toEqual(collision);
    expect(await db.counters.count()).toBe(0);
  });
  it("rejects duplicate edges with distinct UUIDs and malformed metadata", async () => {
    const { c, e, h } = await setup();
    await saveRelationship({ caseId: c.id, from: e.id, to: h.id, type: "SUPPORTS" });
    const b = await createBackup();
    b.relationships.push({ ...b.relationships[0], id: crypto.randomUUID() });
    expect(() => validateBackup(b)).toThrow("Duplicate identical");
    const mutations: ((b: Backup) => void)[] = [
      (b) => {
        b.relationships[0].supportingEvidenceIds = [e.id, e.id];
      },
      (b) => {
        b.relationships[0].supportingEvidenceIds = "bad" as unknown as string[];
      },
      (b) => {
        b.relationships[0].updatedAt =
          "not a date" as (typeof b.relationships)[0]["updatedAt"];
      },
      (b) => {
        b.activity[0].timestamp =
          "2026-02-30T00:00:00.000Z" as (typeof b.activity)[0]["timestamp"];
      },
      (b) => {
        b.schemaVersion = 3 as 2;
      },
      (b) => {
        b.records[0].values.tags = "bad" as unknown as string[];
      },
    ];
    const valid = await createBackup();
    for (const mutate of mutations) {
      const bad = structuredClone(valid);
      mutate(bad);
      expect(() => validateBackup(bad)).toThrow();
    }
  });
  it("allows database export after case deletion without stale counter references", async () => {
    const { c } = await setup();
    await deleteRecord(c);
    validateBackup(await createBackup());
  });
});
