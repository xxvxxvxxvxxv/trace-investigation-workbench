import { randomId } from "../../utils/identity";
import type { Transaction } from "dexie";
import {
  definitions,
  type RecordItem,
  type Kind,
  type Values,
  type Relationship,
} from "../../models/schema";
import { normalizeInstant, inputAsUTC, nowUTC } from "../../models/time";
import { fieldRelation, relationKey } from "../../models/relations";
import {
  isObject,
  uuid,
  validateRecord,
  validateRelationship,
  codeScope,
} from "../../models/validation";
export interface LegacyRecord {
  id: string;
  kind: Kind;
  caseId: string;
  code: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  values: Record<string, string>;
}
export interface LegacyRelationship {
  id: string;
  caseId: string;
  from: string;
  to: string;
  type: string;
}
export function migrateLegacyValues(kind: Kind, input: Record<string, string>): Values {
  const values: Values = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      definitions[kind].fields.some((f) => f.key === key && f.type === "links") ||
      ["timestamp", "endTimestamp"].includes(key)
    )
      continue;
    if (["tags", "aliases"].includes(key)) {
      values[key] = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (key === "attributes") {
      const attributes: Record<string, string> = {};
      let valid = true;
      for (const line of value.split("\n").filter(Boolean)) {
        const index = line.indexOf(":");
        const name = line.slice(0, index).trim();
        if (index < 1 || Object.hasOwn(attributes, name)) {
          valid = false;
          break;
        }
        Object.defineProperty(attributes, name, {
          value: line.slice(index + 1).trim(),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      values.attributes = valid ? attributes : { _legacyText: value };
    } else if (["latitude", "longitude"].includes(key)) {
      if (value.trim()) values[key] = Number(value);
    } else if (key === "favorite") {
      if (value && !["yes", "no"].includes(value))
        throw new Error("Invalid legacy boolean.");
      values.favorite = value === "yes";
    } else if (["observed", "collected", "lastUsed"].includes(key)) {
      if (value) values[key] = inputAsUTC(value);
    } else values[key] = value;
  }
  if (input.timestamp) {
    values.time = {
      start: inputAsUTC(input.timestamp),
      ...(input.endTimestamp ? { end: inputAsUTC(input.endTimestamp) } : {}),
      precision: "minute",
      qualifier: input.endTimestamp ? "range" : "exact",
      originalInput: input.timestamp,
      ...(input.endTimestamp ? { originalEndInput: input.endTimestamp } : {}),
      assumedTimezone: "UTC",
    };
  } else if (input.endTimestamp) throw new Error("Legacy end timestamp has no start.");
  return values;
}
function legacyRecord(input: unknown): LegacyRecord {
  if (
    !isObject(input) ||
    !isObject(input.values) ||
    !Object.values(input.values).every((v) => typeof v === "string") ||
    typeof input.kind !== "string" ||
    !Object.hasOwn(definitions, input.kind)
  )
    throw new Error("Malformed legacy record.");
  for (const key of ["id", "caseId", "code", "title", "createdAt", "updatedAt"])
    if (typeof input[key] !== "string")
      throw new Error(`Malformed legacy record ${String(input.id)}: ${key}.`);
  return input as unknown as LegacyRecord;
}
export function migrateV1(recordsInput: unknown[], relationsInput: unknown[]) {
  const legacy = recordsInput.map(legacyRecord);
  const records = legacy.map((r) => {
    try {
      const migrated: RecordItem = {
        ...r,
        createdAt: normalizeInstant(r.createdAt),
        updatedAt: normalizeInstant(r.updatedAt),
        values: migrateLegacyValues(r.kind, r.values),
      };
      validateRecord(migrated);
      return migrated;
    } catch (error) {
      throw new Error(
        `Migration stopped at record ${r.id}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  });
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Duplicate legacy record ID.");
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const r of records)
    if (r.kind !== "tools" && byId.get(r.caseId)?.kind !== "cases")
      throw new Error(`Missing case for ${r.id}.`);
  const relationships: Relationship[] = [];
  const keys = new Map<string, Relationship>();
  const ids = new Set<string>();
  const insert = (relation: Relationship) => {
    validateRelationship(relation, byId);
    const key = relationKey(relation);
    const existing = keys.get(key);
    if (existing) {
      existing.legacyIds = [
        ...new Set([...(existing.legacyIds ?? []), ...(relation.legacyIds ?? [])]),
      ];
      existing.legacyFields = [
        ...(existing.legacyFields ?? []),
        ...(relation.legacyFields ?? []),
      ];
      existing.createdAt =
        existing.createdAt < relation.createdAt ? existing.createdAt : relation.createdAt;
      existing.updatedAt =
        existing.updatedAt > relation.updatedAt ? existing.updatedAt : relation.updatedAt;
    } else {
      keys.set(key, relation);
      relationships.push(relation);
    }
  };
  for (const input of relationsInput) {
    try {
      if (
        !isObject(input) ||
        !["id", "caseId", "from", "to", "type"].every((k) => typeof input[k] === "string")
      )
        throw new Error("Malformed legacy relationship.");
      const r = input as unknown as LegacyRelationship;
      uuid(r.id);
      if (ids.has(r.id)) throw new Error("Duplicate legacy relationship ID.");
      ids.add(r.id);
      const timestamp = byId.get(r.from)?.createdAt ?? nowUTC();
      insert({ ...r, createdAt: timestamp, updatedAt: timestamp, legacyIds: [r.id] });
    } catch (error) {
      throw new Error(
        `Migration stopped at relationship ${isObject(input) ? String(input.id) : "unknown"}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
  for (const old of legacy) {
    const record = byId.get(old.id)!;
    for (const field of definitions[old.kind].fields.filter((f) => f.type === "links")) {
      const raw = old.values[field.key];
      if (!raw) continue;
      for (const id of raw.split(",")) {
        try {
          uuid(id);
          const target = byId.get(id);
          if (!target) throw new Error(`Missing target ${id}.`);
          insert({
            id: randomId(),
            ...fieldRelation(record, field, target),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            legacyFields: [{ recordId: record.id, field: field.key }],
          });
        } catch (error) {
          throw new Error(
            `Migration stopped at ${old.id}.${field.key}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      }
    }
  }
  return { records, relationships };
}
export async function upgradeV2(tx: Transaction) {
  const { records, relationships } = migrateV1(
    await tx.table("records").toArray(),
    await tx.table("relationships").toArray(),
  );
  await tx.table("records").bulkPut(records);
  await tx.table("relationships").clear();
  await tx.table("relationships").bulkAdd(relationships);
  const oldCounters = await tx
    .table<{ id: string; value: number }, string>("counters")
    .toArray();
  const counters = new Map<string, number>();
  for (const c of oldCounters) {
    if (!Number.isSafeInteger(c.value) || c.value < 0)
      throw new Error("Invalid legacy counter.");
    const key = c.id.startsWith("cases:")
      ? "cases:workspace"
      : c.id.startsWith("tools:")
        ? "tools:workspace"
        : c.id;
    counters.set(key, Math.max(counters.get(key) ?? 0, c.value));
  }
  for (const r of records) {
    const key = codeScope(r.kind, r.caseId);
    counters.set(
      key,
      Math.max(counters.get(key) ?? 0, Number(r.code.replace(/^\D+/, ""))),
    );
  }
  await tx.table("counters").clear();
  await tx.table("counters").bulkPut([...counters].map(([id, value]) => ({ id, value })));
  await tx.table("meta").put({
    id: "migration:v2",
    value: JSON.stringify({
      from: 1,
      to: 2,
      applicationVersion: "0.2.0-alpha",
      completedAt: nowUTC(),
      legacyTimeAssumption: "UTC",
      legacyRelationships: await tx.table("relationships").count(),
    }),
  });
}
