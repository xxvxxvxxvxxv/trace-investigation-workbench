import { randomId } from "../utils/identity";
import Dexie, { type Table } from "dexie";
import {
  definitions,
  type RecordItem,
  type Kind,
  type Values,
  type Relationship,
  type Attachment,
  type Activity,
  type LinkSelection,
} from "../models/schema";
import { upgradeV2 } from "./migrations/v2";
import { nowUTC } from "../models/time";
import {
  codeScope,
  idArray,
  validateRecord,
  validateRelationship,
} from "../models/validation";
import { fieldRelation, relationKey, projectLinks } from "../models/relations";
export const V1_STORES = {
  records: "id,kind,caseId,[caseId+kind],updatedAt",
  relationships: "id,caseId,from,to",
  attachments: "id,caseId,recordId",
  activity: "id,caseId,timestamp",
  counters: "id",
  meta: "id",
};
export class TraceDatabase extends Dexie {
  records!: Table<RecordItem, string>;
  relationships!: Table<Relationship, string>;
  attachments!: Table<Attachment, string>;
  activity!: Table<Activity, string>;
  counters!: Table<{ id: string; value: number }, string>;
  meta!: Table<{ id: string; value: string }, string>;
  constructor(name = "trace-workbench") {
    super(name);
    this.version(1).stores(V1_STORES);
    this.version(2)
      .stores({
        ...V1_STORES,
        relationships:
          "id,caseId,from,to,type,[caseId+type],[caseId+from],[caseId+to],[caseId+from+to+type],*supportingEvidenceIds,sourceId",
      })
      .upgrade(upgradeV2);
  }
}
export const db = new TraceDatabase();
export type RelationshipDraft = Omit<Relationship, "id" | "createdAt" | "updatedAt">;
async function putRelation(
  input: RelationshipDraft,
  store: TraceDatabase,
  existing?: Relationship,
) {
  const now = nowUTC();
  const relation: Relationship = {
    ...input,
    id: existing?.id ?? randomId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const records = new Map((await store.records.toArray()).map((r) => [r.id, r]));
  validateRelationship(relation, records);
  const duplicate = await store.relationships
    .where("[caseId+from+to+type]")
    .equals([relation.caseId, relation.from, relation.to, relation.type])
    .first();
  if (duplicate && duplicate.id !== existing?.id)
    throw new Error("An identical relationship already exists.");
  await store.relationships.put(relation);
  return relation;
}
export async function saveRelationship(
  input: RelationshipDraft,
  existing?: Relationship,
  store = db,
) {
  return store.transaction("rw", [store.records, store.relationships], async () => {
    if (existing) {
      const current = await store.relationships.get(existing.id);
      if (!current || current.updatedAt !== existing.updatedAt)
        throw new Error("Relationship changed; reload before editing.");
    }
    return putRelation(input, store, existing);
  });
}
export async function deleteRelationship(id: string, store = db) {
  await store.relationships.delete(id);
}
export function outgoingRelationships(id: string, store = db) {
  return store.relationships.where("from").equals(id).toArray();
}
export function incomingRelationships(id: string, store = db) {
  return store.relationships.where("to").equals(id).toArray();
}
export function relationshipsByType(caseId: string, type: string, store = db) {
  return store.relationships.where("[caseId+type]").equals([caseId, type]).toArray();
}
export async function linkedRecords(id: string, store = db) {
  const relations = await store.relationships
    .where("from")
    .equals(id)
    .or("to")
    .equals(id)
    .toArray();
  const ids = [...new Set(relations.map((r) => (r.from === id ? r.to : r.from)))];
  return (await store.records.bulkGet(ids)).filter((r): r is RecordItem => !!r);
}
export async function saveRecord(
  kind: Kind,
  caseId: string,
  title: string,
  values: Values,
  existing?: RecordItem,
  links?: LinkSelection,
  store = db,
) {
  return store.transaction(
    "rw",
    [store.records, store.counters, store.activity, store.relationships],
    async () => {
      const current = existing ? await store.records.get(existing.id) : undefined;
      if (
        existing &&
        (!current ||
          current.updatedAt !== existing.updatedAt ||
          current.kind !== kind ||
          current.caseId !== existing.caseId)
      )
        throw new Error("Record changed; reload before editing.");
      if (current && kind !== "cases" && kind !== "tools" && caseId !== current.caseId)
        throw new Error("Moving a record between cases is not supported.");
      const id = existing?.id ?? randomId();
      const scope = kind === "cases" ? id : kind === "tools" ? "" : caseId;
      if (
        kind !== "cases" &&
        kind !== "tools" &&
        (await store.records.get(scope))?.kind !== "cases"
      )
        throw new Error("Create or select a case first.");
      const counterId = codeScope(kind, scope);
      let code = current?.code;
      if (!code) {
        const n = ((await store.counters.get(counterId))?.value ?? 0) + 1;
        await store.counters.put({ id: counterId, value: n });
        code = `${definitions[kind].prefix}${String(n).padStart(3, "0")}`;
      }
      const now = nowUTC();
      const record: RecordItem = {
        id,
        kind,
        caseId: scope,
        code,
        title: title.trim(),
        values,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      validateRecord(record);
      await store.records.put(record);
      if (links !== undefined) {
        const all = await store.records.toArray();
        const byId = new Map(all.map((r) => [r.id, r]));
        const relations = await store.relationships.toArray();
        const oldLinks = projectLinks(record, all, relations);
        const remove = new Set<string>();
        const wanted = new Map<string, RelationshipDraft>();
        for (const [key, ids] of Object.entries(links)) {
          const field = definitions[kind].fields.find(
            (f) => f.key === key && f.type === "links",
          );
          if (!field) throw new Error("Unknown link field.");
          idArray(ids);
          for (const old of oldLinks[key] ?? []) {
            const target = byId.get(old)!;
            remove.add(relationKey(fieldRelation(record, field, target)));
          }
          for (const targetId of ids) {
            const target = byId.get(targetId);
            if (!target) throw new Error("Invalid linked record.");
            const relation = fieldRelation(record, field, target);
            wanted.set(relationKey(relation), relation);
          }
        }
        for (const relation of relations)
          if (remove.has(relationKey(relation)) && !wanted.has(relationKey(relation)))
            await store.relationships.delete(relation.id);
        const existingKeys = new Set(relations.map(relationKey));
        for (const [key, relation] of wanted)
          if (!existingKeys.has(key)) await putRelation(relation, store);
      }
      await store.activity.add({
        id: randomId(),
        caseId: scope,
        description: `${current ? "Updated" : "Created"} ${code} · ${record.title}`,
        timestamp: now,
      });
      return record;
    },
  );
}
export async function deleteRecord(record: RecordItem, store = db) {
  await store.transaction(
    "rw",
    [store.records, store.relationships, store.attachments, store.activity],
    async () => {
      const ids =
        record.kind === "cases"
          ? (await store.records.where("caseId").equals(record.id).toArray()).map(
              (r) => r.id,
            )
          : [record.id];
      const set = new Set(ids);
      await store.records.bulkDelete(ids);
      await store.relationships
        .filter((r) => set.has(r.from) || set.has(r.to) || r.caseId === record.id)
        .delete();
      await store.attachments.filter((a) => set.has(a.recordId)).delete();
      for (const relation of await store.relationships.toArray()) {
        const cleaned = { ...relation };
        let changed = false;
        if (cleaned.sourceId && set.has(cleaned.sourceId)) {
          delete cleaned.sourceId;
          changed = true;
        }
        if (cleaned.supportingEvidenceIds?.some((id) => set.has(id))) {
          cleaned.supportingEvidenceIds = cleaned.supportingEvidenceIds.filter(
            (id) => !set.has(id),
          );
          changed = true;
        }
        if (changed) {
          cleaned.updatedAt = nowUTC();
          await store.relationships.put(cleaned);
        }
      }
      if (record.kind === "cases")
        await store.activity.where("caseId").equals(record.id).delete();
      else
        await store.activity.add({
          id: randomId(),
          caseId: record.caseId,
          description: `Deleted ${record.code} · ${record.title}`,
          timestamp: nowUTC(),
        });
    },
  );
}
export async function addAttachment(record: RecordItem, file: File, store = db) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error(
      "Choose a file of 10 MB or less. Keep originals in your evidence archive.",
    );
  const bytes = await file.arrayBuffer();
  if (!crypto.subtle)
    throw new Error(
      "Attachment integrity checks require HTTPS or localhost. Open TRACE on a secure origin and retry.",
    );
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await store.transaction("rw", [store.records, store.attachments], async () => {
    const current = await store.records.get(record.id);
    if (!current || current.caseId !== record.caseId)
      throw new Error("Attachment record no longer exists.");
    await store.attachments.add({
      id: randomId(),
      recordId: record.id,
      caseId: record.caseId,
      name: file.name,
      mime: file.type,
      size: file.size,
      sha256,
      createdAt: nowUTC(),
      blob: file,
    });
  });
}
