import {
  definitions,
  type Field,
  type RecordItem,
  type Relationship,
  type LinkSelection,
} from "./schema";
export type RelationEndpoints = Pick<Relationship, "caseId" | "from" | "to" | "type">;
export function fieldRelation(
  owner: RecordItem,
  field: Field,
  target: RecordItem,
): RelationEndpoints {
  if (field.type !== "links" || target.kind !== field.target || owner.id === target.id)
    throw new Error("Invalid linked record.");
  let from = owner.id,
    to = target.id,
    type = "CONNECTED_TO";
  if (field.key === "supporting" || field.key === "contradicting") {
    type = field.key === "supporting" ? "SUPPORTS" : "CONTRADICTS";
    from = target.id;
    to = owner.id;
  } else if (owner.kind === "sources" || target.kind === "sources") {
    type = target.kind === "cases" ? "CASE_REFERENCE" : "SOURCE_FOR";
    from = owner.kind === "sources" ? owner.id : target.id;
    to = owner.kind === "sources" ? target.id : owner.id;
  } else if (
    (owner.kind === "evidence" && target.kind === "timeline") ||
    (owner.kind === "timeline" && target.kind === "evidence")
  ) {
    type = "EVIDENCE_FOR";
    from = owner.kind === "evidence" ? owner.id : target.id;
    to = owner.kind === "evidence" ? target.id : owner.id;
  } else if (target.kind === "locations" || owner.kind === "locations") {
    type = "LOCATED_AT";
    from = owner.kind === "locations" ? target.id : owner.id;
    to = owner.kind === "locations" ? owner.id : target.id;
  } else if (
    (owner.kind === "evidence" && target.kind === "entities") ||
    (owner.kind === "entities" && target.kind === "evidence")
  ) {
    type = "MENTIONS";
    from = owner.kind === "evidence" ? owner.id : target.id;
    to = owner.kind === "evidence" ? target.id : owner.id;
  } else [from, to] = [from, to].sort();
  const relation = { caseId: owner.caseId, from, to, type };
  validateEndpoints(
    relation,
    new Map([
      [owner.id, owner],
      [target.id, target],
    ]),
  );
  return relation;
}
export const relationKey = (r: RelationEndpoints) =>
  JSON.stringify([r.caseId, r.from, r.to, r.type]);
export function validateEndpoints(
  r: RelationEndpoints,
  records: Map<string, RecordItem>,
) {
  const from = records.get(r.from),
    to = records.get(r.to);
  if (
    !r.type.trim() ||
    r.type !== r.type.trim() ||
    !from ||
    !to ||
    from.id === to.id ||
    !r.caseId ||
    from.caseId !== r.caseId ||
    (to.caseId !== r.caseId &&
      !(r.type === "CASE_REFERENCE" && from.kind === "sources" && to.kind === "cases"))
  )
    throw new Error("Relationship references missing or unrelated records.");
  if (
    ["SUPPORTS", "CONTRADICTS"].includes(r.type) &&
    (from.kind !== "evidence" || to.kind !== "hypotheses")
  )
    throw new Error(
      "Supporting/contradicting relationships require evidence → hypothesis.",
    );
  if (
    r.type === "SOURCE_FOR" &&
    (from.kind !== "sources" || to.kind === "cases" || to.kind === "tools")
  )
    throw new Error("Source provenance requires a source → case record.");
  if (r.type === "ROUTE" && (from.kind !== "locations" || to.kind !== "locations"))
    throw new Error("Routes require two locations.");
  if (r.type === "CASE_REFERENCE" && (from.kind !== "sources" || to.kind !== "cases"))
    throw new Error("Case references require source → case.");
}
export function projectLinks(
  record: RecordItem,
  records: RecordItem[],
  relations: Relationship[],
): LinkSelection {
  const keys = new Set(relations.map(relationKey));
  const selections: LinkSelection = {};
  for (const field of definitions[record.kind].fields.filter((f) => f.type === "links")) {
    selections[field.key] = records
      .filter(
        (target) =>
          target.kind === field.target &&
          target.id !== record.id &&
          (target.caseId === record.caseId || target.kind === "cases"),
      )
      .filter((target) => keys.has(relationKey(fieldRelation(record, field, target))))
      .map((r) => r.id);
  }
  return selections;
}
