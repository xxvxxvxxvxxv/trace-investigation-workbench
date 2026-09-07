import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect } from "vitest";
import { TraceDatabase, V1_STORES, deleteRecord, saveRecord } from "../database";
import { migrateV1 } from "./v2";
import { createBackup, validateBackup } from "../../utils/backup";
import { legacyFixture } from "./legacyFixture";
const instant = "2026-08-18T10:00:00.000Z";
async function openLegacy(name: string, fixture: ReturnType<typeof legacyFixture>) {
  const old = new Dexie(name);
  old.version(1).stores(V1_STORES);
  await old.open();
  await old.table("records").bulkAdd(fixture.records);
  await old.table("relationships").bulkAdd(fixture.relationships);
  await old.table("counters").bulkAdd([
    { id: `cases:${fixture.c}`, value: 8 },
    { id: `evidence:${fixture.c}`, value: 9 },
  ]);
  await old.table("meta").put({ id: "initialized", value: "1" });
  await old.table("attachments").add({
    id: crypto.randomUUID(),
    recordId: fixture.e,
    caseId: fixture.c,
    name: "original.txt",
    mime: "text/plain",
    size: 3,
    sha256: "a".repeat(64),
    createdAt: instant,
    blob: new Blob(["abc"]),
  });
  await old.table("activity").add({
    id: crypto.randomUUID(),
    caseId: fixture.c,
    description: "Original activity",
    timestamp: instant,
  });
  old.close();
}
describe("v1 → v2 migration", () => {
  it("upgrades an actual IndexedDB v1 database without losing records, files, or history", async () => {
    const f = legacyFixture();
    const name = `migration-${crypto.randomUUID()}`;
    await openLegacy(name, f);
    const store = new TraceDatabase(name);
    try {
      await store.open();
      expect(store.verno).toBe(2);
      expect(await store.records.count()).toBe(f.records.length);
      expect(await store.attachments.count()).toBe(1);
      expect(await (await store.attachments.toArray())[0].blob.text()).toBe("abc");
      expect(await store.activity.count()).toBe(1);
      const h = await store.records.get(f.h);
      expect(h!.values.supporting).toBeUndefined();
      expect(await store.relationships.where("type").equals("SUPPORTS").count()).toBe(1);
      expect(await store.relationships.where("type").equals("CONTRADICTS").count()).toBe(
        1,
      );
      expect(await store.relationships.where("type").equals("SOURCE_FOR").count()).toBe(
        1,
      );
      expect((await store.records.get(f.ev))!.values.time).toMatchObject({
        start: "2026-08-10T09:00:00.000Z",
        end: "2026-08-10T10:00:00.000Z",
        assumedTimezone: "UTC",
        originalInput: "2026-08-10T09:00",
      });
      expect((await store.records.get(f.l))!.values.latitude).toBe(50.807);
      expect((await store.records.get(f.ent))!.values.aliases).toEqual([
        "Relay",
        "Station",
      ]);
      expect((await store.records.get(f.c))!.values.tags).toEqual(["demo", "fictional"]);
      expect(
        (await saveRecord("cases", f.c, "New case", {}, undefined, undefined, store))
          .code,
      ).toBe("CASE009");
      expect(
        (
          await saveRecord(
            "evidence",
            f.c,
            "New evidence",
            {},
            undefined,
            undefined,
            store,
          )
        ).code,
      ).toBe("E010");
      const count = await store.relationships.count();
      store.close();
      await store.open();
      expect(await store.relationships.count()).toBe(count);
    } finally {
      store.close();
      await Dexie.delete(name);
    }
  });
  it("coalesces identical legacy edges and retains all original IDs", async () => {
    const f = legacyFixture();
    f.relationships.push({ ...f.relationships[0], id: crypto.randomUUID() });
    const name = `duplicate-${crypto.randomUUID()}`;
    await openLegacy(name, f);
    const store = new TraceDatabase(name);
    try {
      await store.open();
      const edges = await store.relationships.where("type").equals("SEEN_AT").toArray();
      expect(edges).toHaveLength(1);
      expect([...(edges[0].legacyIds ?? [])].sort()).toEqual(
        f.relationships.map((r) => r.id).sort(),
      );
    } finally {
      store.close();
      await Dexie.delete(name);
    }
  });
  it("aborts and preserves v1 unchanged on dangling or malformed legacy links", async () => {
    for (const broken of ["missing-target", `${crypto.randomUUID()},`]) {
      const f = legacyFixture();
      f.records.find((r) => r.id === f.h)!.values.supporting = broken;
      const name = `invalid-${crypto.randomUUID()}`;
      await openLegacy(name, f);
      const store = new TraceDatabase(name);
      await expect(store.open()).rejects.toThrow("Migration stopped");
      store.close();
      const old = new Dexie(name);
      old.version(1).stores(V1_STORES);
      try {
        await old.open();
        expect(old.verno).toBe(1);
        expect(await old.table("records").get(f.h)).toEqual(
          f.records.find((r) => r.id === f.h),
        );
        expect(await old.table("attachments").count()).toBe(1);
      } finally {
        old.close();
        await Dexie.delete(name);
      }
    }
  });
  it("reports malformed explicit relationships rather than dropping them", () => {
    const f = legacyFixture();
    f.relationships[0].to = crypto.randomUUID();
    expect(() => migrateV1(f.records, f.relationships)).toThrow(
      `relationship ${f.relationships[0].id}`,
    );
  });
  it("cleans migrated relationships and attachments when deleting an evidence record", async () => {
    const f = legacyFixture();
    const name = `cleanup-${crypto.randomUUID()}`;
    await openLegacy(name, f);
    const store = new TraceDatabase(name);
    try {
      await store.open();
      await deleteRecord((await store.records.get(f.e))!, store);
      expect(await store.attachments.count()).toBe(0);
      expect(
        await store.relationships.filter((r) => r.from === f.e || r.to === f.e).count(),
      ).toBe(0);
      validateBackup(await createBackup(undefined, store));
    } finally {
      store.close();
      await Dexie.delete(name);
    }
  });
});
