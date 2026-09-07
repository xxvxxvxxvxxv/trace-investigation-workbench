import { db, type TraceDatabase } from "../db/database";
import {
  APP_VERSION,
  SCHEMA_VERSION,
  definitions,
  type RecordItem,
  type Relationship,
  type Activity,
  type Attachment,
} from "../models/schema";
import { assertUTC, nowUTC } from "../models/time";
import {
  isObject,
  uuid,
  validateRecord,
  validateRelationship,
  codeScope,
} from "../models/validation";
import { relationKey } from "../models/relations";
import { migrateV1 } from "../db/migrations/v2";
import { recordView, type RecordView } from "../presentation/records";
export interface Backup {
  format: "TRACE";
  version: 2;
  schemaVersion: 2;
  applicationVersion: string;
  exportedAt: string;
  scope: "database" | "case";
  migratedFrom?: 1;
  records: RecordItem[];
  relationships: Relationship[];
  activity: Activity[];
  attachments: (Omit<Attachment, "blob"> & { data: string })[];
  counters: { id: string; value: number }[];
  migrationHistory: {
    from: number;
    to: number;
    completedAt: string;
    applicationVersion: string;
  }[];
}
export function download(data: Blob | string, name: string, mime = "application/json") {
  const url = URL.createObjectURL(
    data instanceof Blob ? data : new Blob([data], { type: mime }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function encode(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export async function createBackup(caseId?: string, store = db): Promise<Backup> {
  const snapshot = await store.transaction("r", store.tables, async () => ({
    records: await store.records.toArray(),
    relationships: await store.relationships.toArray(),
    activity: await store.activity.toArray(),
    attachments: await store.attachments.toArray(),
    counters: await store.counters.toArray(),
    migration: (await store.meta.get("migration:v2"))?.value,
  }));
  const records = snapshot.records.filter((r) => !caseId || r.caseId === caseId);
  const ids = new Set(records.map((r) => r.id));
  const relationships = snapshot.relationships.filter(
    (r) => ids.has(r.from) && ids.has(r.to),
  );
  const backup: Backup = {
    format: "TRACE",
    version: 2,
    schemaVersion: SCHEMA_VERSION,
    applicationVersion: APP_VERSION,
    exportedAt: nowUTC(),
    scope: caseId ? "case" : "database",
    records,
    relationships,
    activity: snapshot.activity.filter((r) => !caseId || r.caseId === caseId),
    attachments: await Promise.all(
      snapshot.attachments
        .filter((a) => ids.has(a.recordId))
        .map(async ({ blob, ...a }) => ({ ...a, data: await encode(blob) })),
    ),
    counters: snapshot.counters.filter(
      (c) =>
        (!caseId || c.id.endsWith(`:${caseId}`)) &&
        (c.id.endsWith(":workspace") ||
          snapshot.records.some((r) => r.kind === "cases" && c.id.endsWith(`:${r.id}`))),
    ),
    migrationHistory: snapshot.migration
      ? [JSON.parse(snapshot.migration) as Backup["migrationHistory"][number]]
      : [],
  };
  return validateBackup(backup);
}
function uniqueItems(items: unknown[], name: string) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!isObject(item)) throw new Error(`Invalid ${name}.`);
    uuid(item.id);
    if (ids.has(item.id)) throw new Error(`Duplicate ${name} ID.`);
    ids.add(item.id);
  }
}
function legacyBackup(input: Record<string, unknown>): Record<string, unknown> {
  const migrated = migrateV1(
    input.records as unknown[],
    input.relationships as unknown[],
  );
  const counters = new Map<string, number>();
  for (const r of migrated.records) {
    const id = codeScope(r.kind, r.caseId);
    counters.set(id, Math.max(counters.get(id) ?? 0, Number(r.code.replace(/^\D+/, ""))));
  }
  return {
    ...input,
    ...migrated,
    version: 2,
    schemaVersion: 2,
    applicationVersion: APP_VERSION,
    migratedFrom: 1,
    counters: [...counters].map(([id, value]) => ({ id, value })),
    migrationHistory: [
      { from: 1, to: 2, completedAt: nowUTC(), applicationVersion: APP_VERSION },
    ],
  };
}
export function validateBackup(input: unknown): Backup {
  if (
    !isObject(input) ||
    input.format !== "TRACE" ||
    ![1, 2].includes(input.version as number) ||
    !["database", "case"].includes(String(input.scope))
  )
    throw new Error("Unsupported TRACE backup format or version.");
  for (const key of ["records", "relationships", "activity", "attachments"])
    if (!Array.isArray(input[key])) throw new Error(`Backup is missing ${key}.`);
  const data = input.version === 1 ? legacyBackup(input) : input;
  if (
    data.schemaVersion !== 2 ||
    typeof data.applicationVersion !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(data.applicationVersion)
  )
    throw new Error("Invalid schema/application version metadata.");
  if (data.migratedFrom !== undefined && data.migratedFrom !== 1)
    throw new Error("Unsupported migration origin.");
  assertUTC(data.exportedAt);
  for (const key of ["records", "relationships", "activity", "attachments"])
    uniqueItems(data[key] as unknown[], key);
  const records = data.records as RecordItem[];
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const r of records) {
    validateRecord(r);
    if (r.kind !== "tools" && byId.get(r.caseId)?.kind !== "cases")
      throw new Error("Record references a missing case.");
  }
  if (
    data.scope === "case" &&
    (records.filter((r) => r.kind === "cases").length !== 1 ||
      new Set(records.map((r) => r.caseId)).size !== 1)
  )
    throw new Error("Case backup must contain exactly one complete case.");
  const keys = new Set<string>();
  for (const relation of data.relationships as Relationship[]) {
    validateRelationship(relation, byId);
    const key = relationKey(relation);
    if (keys.has(key)) throw new Error("Duplicate identical relationship.");
    keys.add(key);
  }
  for (const a of data.activity as Activity[]) {
    if (
      typeof a.description !== "string" ||
      typeof a.caseId !== "string" ||
      (a.caseId !== "" && byId.get(a.caseId)?.kind !== "cases")
    )
      throw new Error("Invalid activity record.");
    assertUTC(a.timestamp);
  }
  for (const a of data.attachments as Backup["attachments"]) {
    uuid(a.recordId);
    if (
      typeof a.caseId !== "string" ||
      byId.get(a.recordId)?.caseId !== a.caseId ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      typeof a.mime !== "string" ||
      typeof a.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      !Number.isSafeInteger(a.size) ||
      a.size < 0 ||
      a.size > 10 * 1024 * 1024 ||
      typeof a.data !== "string" ||
      a.data.length > 14 * 1024 * 1024 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data)
    )
      throw new Error("Invalid attachment metadata or encoding.");
    assertUTC(a.createdAt);
  }
  if (!Array.isArray(data.counters) || !Array.isArray(data.migrationHistory))
    throw new Error("Missing counters or migration metadata.");
  const counterIds = new Set<string>();
  for (const c of data.counters as Backup["counters"]) {
    if (
      !isObject(c) ||
      typeof c.id !== "string" ||
      !Number.isSafeInteger(c.value) ||
      c.value < 0 ||
      counterIds.has(c.id)
    )
      throw new Error("Invalid counter.");
    const [kind, scope, ...extra] = c.id.split(":");
    if (
      extra.length ||
      !Object.hasOwn(definitions, kind) ||
      (["cases", "tools"].includes(kind)
        ? scope !== "workspace"
        : byId.get(scope)?.kind !== "cases")
    )
      throw new Error("Invalid counter scope.");
    counterIds.add(c.id);
  }
  for (const migration of data.migrationHistory as Backup["migrationHistory"]) {
    if (
      !isObject(migration) ||
      migration.from !== 1 ||
      migration.to !== 2 ||
      typeof migration.applicationVersion !== "string"
    )
      throw new Error("Invalid migration history.");
    assertUTC(migration.completedAt);
  }
  return data as unknown as Backup;
}
export async function importBackup(input: unknown, store: TraceDatabase = db) {
  const b = validateBackup(input);
  const attachments: Attachment[] = [];
  for (const { data, ...a } of b.attachments) {
    const raw = atob(data);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    if (bytes.length !== a.size) throw new Error("Attachment size mismatch.");
    if (!crypto.subtle)
      throw new Error(
        "Restoring attachments requires HTTPS or localhost for SHA-256 integrity checks.",
      );
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== a.sha256) throw new Error("Attachment checksum mismatch.");
    attachments.push({ ...a, blob: new Blob([bytes], { type: a.mime }) });
  }
  await store.transaction("rw", store.tables, async () => {
    for (const r of b.records)
      if (await store.records.get(r.id))
        throw new Error(
          "This backup overlaps existing records. Restore into an empty or non-overlapping workspace.",
        );
    for (const a of attachments)
      if (await store.attachments.get(a.id)) throw new Error("Attachment ID collision.");
    for (const r of b.relationships)
      if (await store.relationships.get(r.id))
        throw new Error("Relationship ID collision.");
    for (const a of b.activity)
      if (await store.activity.get(a.id)) throw new Error("Activity ID collision.");
    await store.records.bulkAdd(b.records);
    await store.relationships.bulkAdd(b.relationships);
    await store.attachments.bulkAdd(attachments);
    await store.activity.bulkAdd(b.activity);
    const counters = new Map(b.counters.map((c) => [c.id, c.value]));
    for (const r of b.records) {
      const id = codeScope(r.kind, r.caseId);
      counters.set(
        id,
        Math.max(counters.get(id) ?? 0, Number(r.code.replace(/^\D+/, ""))),
      );
    }
    for (const [id, value] of counters) {
      const old = (await store.counters.get(id))?.value ?? 0;
      await store.counters.put({ id, value: Math.max(old, value) });
    }
    if (b.migrationHistory.length && !(await store.meta.get("migration:v2")))
      await store.meta.put({
        id: "migration:v2",
        value: JSON.stringify(b.migrationHistory[0]),
      });
    await store.meta.put({ id: "initialized", value: "1" });
    const c = b.records.find((r) => r.kind === "cases");
    if (c) await store.meta.put({ id: "activeCase", value: c.id });
  });
}
export function csv(
  records: RecordItem[],
  kind: RecordItem["kind"],
  views?: RecordView[],
) {
  const keys = [
    "code",
    "title",
    ...definitions[kind].fields.map((f) => f.key),
    "createdAt",
    "updatedAt",
  ];
  const cell = (v: string) =>
    '"' + (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      keys.map(cell).join(","),
      ...records.map((record) => {
        const r =
          views?.find((v) => v.id === record.id) ?? recordView(record, records, []);
        return keys
          .map((k) =>
            cell(
              k === "code"
                ? r.code
                : k === "title"
                  ? r.title
                  : k === "createdAt"
                    ? r.createdAt
                    : k === "updatedAt"
                      ? r.updatedAt
                      : definitions[kind].fields.some(
                            (f) => f.key === k && f.type === "links",
                          )
                        ? JSON.stringify(r.links[k] ?? [])
                        : k === "timestamp"
                          ? (record.values.time?.start ?? "")
                          : k === "endTimestamp"
                            ? (record.values.time?.end ?? "")
                            : ["observed", "collected", "lastUsed"].includes(k)
                              ? String(record.values[k] ?? "")
                              : (r.values[k] ?? ""),
            ),
          )
          .join(",");
      }),
    ].join("\r\n")
  );
}
