import type { LegacyRecord, LegacyRelationship } from "./v2";
const instant = "2026-08-18T10:00:00.000Z";
export function legacyFixture() {
  const c = crypto.randomUUID(),
    e = crypto.randomUUID(),
    h = crypto.randomUUID(),
    s = crypto.randomUUID(),
    ev = crypto.randomUUID(),
    l = crypto.randomUUID(),
    ent = crypto.randomUUID();
  const record = (
    id: string,
    kind: LegacyRecord["kind"],
    code: string,
    values: Record<string, string> = {},
  ): LegacyRecord => ({
    id,
    kind,
    caseId: c,
    code,
    title: `Fictional ${code}`,
    createdAt: instant,
    updatedAt: instant,
    values,
  });
  const records = [
    record(c, "cases", "CASE001", { tags: "demo, fictional" }),
    record(e, "evidence", "E001", {
      sources: s,
      entities: ent,
      locations: l,
      observed: "2026-08-10T09:00",
    }),
    record(h, "hypotheses", "H001", { supporting: e, contradicting: e }),
    record(s, "sources", "S001", { evidence: e }),
    record(ev, "timeline", "EV001", {
      timestamp: "2026-08-10T09:00",
      endTimestamp: "2026-08-10T10:00",
      evidence: e,
    }),
    record(l, "locations", "LOC001", { latitude: "50.807", longitude: "-1.108" }),
    record(ent, "entities", "ENT001", {
      aliases: "Relay, Station",
      attributes: "serial: ABC\nowner: fictional",
    }),
  ];
  const relationships: LegacyRelationship[] = [
    { id: crypto.randomUUID(), caseId: c, from: ent, to: l, type: "SEEN_AT" },
  ];
  return { records, relationships, c, e, h, s, ev, l, ent };
}
