import {
  definitions,
  kinds,
  type Kind,
  type RecordItem,
  type Values,
  type Relationship,
} from "./schema";
import { assertUTC, validateDate, validateTime } from "./time";
import { validateEndpoints } from "./relations";
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function uuid(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  )
    throw new Error("Invalid UUID.");
}
export function idArray(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || new Set(value).size !== value.length)
    throw new Error("Invalid or duplicate structured link array.");
  for (const id of value) uuid(id);
}
export function stringArray(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    throw new Error("Expected a structured string array.");
}
export function safeURL(value: unknown) {
  if (typeof value !== "string") throw new Error("Unsafe URL.");
  try {
    if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error();
  } catch {
    throw new Error("Unsafe URL.");
  }
}
export function validateValues(kind: Kind, values: Values) {
  if (!isObject(values)) throw new Error("Invalid record values.");
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) throw new Error("Undefined values must be omitted.");
    if (["tags", "aliases"].includes(key)) {
      stringArray(value);
      continue;
    }
    if (key === "attributes") {
      if (
        !isObject(value) ||
        !Object.values(value).every(
          (v) =>
            typeof v === "string" ||
            typeof v === "boolean" ||
            (typeof v === "number" && Number.isFinite(v)),
        )
      )
        throw new Error("Invalid entity attributes.");
      continue;
    }
    if (key === "time") {
      if (!isObject(value)) throw new Error("Invalid investigation time.");
      validateTime(value as unknown as NonNullable<Values["time"]>);
      continue;
    }
    if (["latitude", "longitude"].includes(key)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        Math.abs(value) > (key === "latitude" ? 90 : 180)
      )
        throw new Error("Coordinates are out of range.");
      continue;
    }
    if (key === "favorite") {
      if (typeof value !== "boolean") throw new Error("Favorite must be boolean.");
      continue;
    }
    if (["observed", "collected", "lastUsed"].includes(key)) {
      assertUTC(value);
      continue;
    }
    if (
      ["timestamp", "endTimestamp"].includes(key) ||
      definitions[kind].fields.some((f) => f.key === key && f.type === "links")
    )
      throw new Error("Invalid linked or legacy time field in stored values.");
    const field = definitions[kind].fields.find((f) => f.key === key);
    if (field) {
      if (typeof value !== "string") throw new Error(`Invalid field type: ${key}.`);
      if (field.type === "url" && value) safeURL(value);
      if (field.type === "date" && value) validateDate(value);
    } else if (
      typeof value !== "string" &&
      typeof value !== "boolean" &&
      !(typeof value === "number" && Number.isFinite(value)) &&
      !Array.isArray(value)
    )
      throw new Error("Invalid extension value.");
    else if (Array.isArray(value)) stringArray(value);
  }
  for (const field of definitions[kind].fields.filter(
    (f) => f.required && f.key !== "timestamp",
  ))
    if (values[field.key] === undefined || values[field.key] === "")
      throw new Error(`Required field: ${field.key}.`);
  if (kind === "timeline" && !values.time)
    throw new Error("Timeline requires an investigation time.");
}
export function validateRecord(record: RecordItem) {
  uuid(record.id);
  if (!kinds.includes(record.kind)) throw new Error("Invalid record kind.");
  if (record.kind !== "tools") uuid(record.caseId);
  else if (record.caseId !== "") throw new Error("Tools must be workspace-scoped.");
  if (record.kind === "cases" && record.caseId !== record.id)
    throw new Error("Invalid case identity.");
  if (typeof record.title !== "string" || !record.title.trim())
    throw new Error("A title is required.");
  if (
    typeof record.code !== "string" ||
    !new RegExp(`^${definitions[record.kind].prefix}\\d+$`).test(record.code)
  )
    throw new Error("Invalid display code.");
  const codeNumber = Number(record.code.replace(/^\D+/, ""));
  if (!Number.isSafeInteger(codeNumber) || codeNumber < 1)
    throw new Error("Invalid display code number.");
  assertUTC(record.createdAt);
  assertUTC(record.updatedAt);
  if (record.updatedAt < record.createdAt) throw new Error("Update precedes creation.");
  validateValues(record.kind, record.values);
}
export function validateRelationship(r: Relationship, records: Map<string, RecordItem>) {
  uuid(r.id);
  uuid(r.caseId);
  uuid(r.from);
  uuid(r.to);
  if (typeof r.type !== "string") throw new Error("Invalid relationship type.");
  validateEndpoints(r, records);
  assertUTC(r.createdAt);
  assertUTC(r.updatedAt);
  if (r.updatedAt < r.createdAt)
    throw new Error("Relationship update precedes creation.");
  if (
    r.confidence !== undefined &&
    !["confirmed", "high", "moderate", "low", "speculative"].includes(r.confidence)
  )
    throw new Error("Invalid relationship confidence.");
  if (r.notes !== undefined && typeof r.notes !== "string")
    throw new Error("Invalid relationship notes.");
  if (r.supportingEvidenceIds !== undefined) {
    idArray(r.supportingEvidenceIds);
    for (const id of r.supportingEvidenceIds) {
      const target = records.get(id);
      if (target?.kind !== "evidence" || target.caseId !== r.caseId)
        throw new Error("Invalid supporting evidence reference.");
    }
  }
  if (r.sourceId !== undefined) {
    uuid(r.sourceId);
    const source = records.get(r.sourceId);
    if (source?.kind !== "sources" || source.caseId !== r.caseId)
      throw new Error("Invalid provenance source.");
  }
  if (r.provenance !== undefined) {
    if (!isObject(r.provenance)) throw new Error("Invalid provenance.");
    if (r.provenance.url !== undefined) safeURL(r.provenance.url);
    if (
      r.provenance.description !== undefined &&
      typeof r.provenance.description !== "string"
    )
      throw new Error("Invalid provenance description.");
  }
  if (r.legacyIds !== undefined) idArray(r.legacyIds);
  if (r.legacyFields !== undefined) {
    if (!Array.isArray(r.legacyFields)) throw new Error("Invalid legacy field metadata.");
    for (const origin of r.legacyFields) {
      if (
        !isObject(origin) ||
        typeof origin.field !== "string" ||
        typeof origin.recordId !== "string" ||
        ![r.from, r.to].includes(origin.recordId)
      )
        throw new Error("Invalid legacy relationship origin.");
    }
  }
}
export function codeScope(kind: Kind, caseId: string) {
  return `${kind}:${kind === "cases" || kind === "tools" ? "workspace" : caseId}`;
}
