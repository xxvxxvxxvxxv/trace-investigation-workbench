import type { Kind } from "../models/schema";
export type RecordColumn = { label: string; key: string; badge?: boolean };
export const recordColumns: Partial<Record<Kind, RecordColumn[]>> = {
  cases: [
    { label: "Status", key: "status", badge: true },
    { label: "Priority", key: "priority", badge: true },
    { label: "Jurisdiction", key: "jurisdiction" },
  ],
  evidence: [
    { label: "Type", key: "type" },
    { label: "Reliability", key: "reliability", badge: true },
    { label: "Confidence", key: "confidence", badge: true },
    { label: "Observed · UTC", key: "observed" },
    { label: "Files / links", key: "counts" },
  ],
  entities: [
    { label: "Type", key: "type" },
    { label: "Confidence", key: "confidence", badge: true },
    { label: "Relationships", key: "relations" },
  ],
  sources: [
    { label: "Publisher / domain", key: "publisherDomain" },
    { label: "Reliability", key: "reliability", badge: true },
    { label: "Published / accessed", key: "sourceDates" },
    { label: "Evidence", key: "evidenceCount" },
  ],
  hypotheses: [
    { label: "Status", key: "status", badge: true },
    { label: "Confidence", key: "confidence", badge: true },
    { label: "Supports", key: "supportingCount" },
    { label: "Contradicts", key: "contradictingCount" },
  ],
  gaps: [
    { label: "Priority", key: "priority", badge: true },
    { label: "Status", key: "status", badge: true },
    { label: "Evidence", key: "evidenceCount" },
    { label: "Next method", key: "methods" },
  ],
  leads: [
    { label: "Status", key: "status", badge: true },
    { label: "Priority", key: "priority", badge: true },
    { label: "Next action", key: "nextAction" },
  ],
  notes: [
    { label: "Tags", key: "tags" },
    { label: "Relationships", key: "relations" },
    { label: "Updated · UTC", key: "updated" },
  ],
};
