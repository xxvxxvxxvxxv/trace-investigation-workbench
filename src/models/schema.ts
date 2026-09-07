import type { InvestigationTime, UTCInstant } from "./time";
export const kinds = [
  "cases",
  "evidence",
  "entities",
  "timeline",
  "locations",
  "leads",
  "hypotheses",
  "gaps",
  "sources",
  "tools",
  "notes",
] as const;
export type Kind = (typeof kinds)[number];
export type AttributeValue = string | number | boolean;
export type DomainValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, AttributeValue>
  | InvestigationTime;
export interface Values {
  [key: string]: DomainValue | undefined;
  tags?: string[];
  aliases?: string[];
  attributes?: Record<string, AttributeValue>;
  latitude?: number;
  longitude?: number;
  favorite?: boolean;
  time?: InvestigationTime;
  observed?: UTCInstant;
  collected?: UTCInstant;
  lastUsed?: UTCInstant;
}
export type LinkSelection = Record<string, string[]>;
export const APP_VERSION = "0.2.1-beta";
export const SCHEMA_VERSION = 2;

export interface RecordItem {
  id: string;
  kind: Kind;
  caseId: string;
  code: string;
  title: string;
  createdAt: UTCInstant;
  updatedAt: UTCInstant;
  values: Values;
}
export interface Relationship {
  id: string;
  caseId: string;
  from: string;
  to: string;
  type: string;
  createdAt: UTCInstant;
  updatedAt: UTCInstant;
  confidence?: "confirmed" | "high" | "moderate" | "low" | "speculative";
  notes?: string;
  supportingEvidenceIds?: string[];
  sourceId?: string;
  provenance?: { url?: string; description?: string };
  legacyIds?: string[];
  legacyFields?: { recordId: string; field: string }[];
}
export interface Attachment {
  id: string;
  recordId: string;
  caseId: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  createdAt: UTCInstant;
  blob: Blob;
}
export interface Activity {
  id: string;
  caseId: string;
  description: string;
  timestamp: UTCInstant;
}
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "select"
    | "datetime-local"
    | "date"
    | "url"
    | "number"
    | "links";
  options?: readonly string[];
  target?: Kind;
  required?: boolean;
}
export interface Definition {
  label: string;
  singular: string;
  prefix: string;
  subtitle: string;
  fields: Field[];
}
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  options?: readonly string[],
): Field => ({ key, label, type, options });
const links = (target: Kind, label: string, key: string = target): Field => ({
  key,
  label,
  type: "links",
  target,
});
const confidence = field("confidence", "Confidence", "select", [
  "confirmed",
  "high",
  "moderate",
  "low",
  "speculative",
]);
const priority = field("priority", "Priority", "select", [
  "medium",
  "high",
  "critical",
  "low",
]);
const tags = field("tags", "Tags (comma separated)");
const description = field("description", "Description", "textarea");
const notes = field("notes", "Analyst notes", "textarea");
const status = (options: string[]) => field("status", "Status", "select", options);
const reliability = field("reliability", "Source reliability", "select", [
  "A — official / primary authoritative",
  "B — strong primary / independently verified",
  "C — credible secondary",
  "D — unverified public claim",
  "E — questionable",
  "F — contradicted / unreliable",
]);
export const definitions: Record<Kind, Definition> = {
  cases: {
    label: "Cases",
    singular: "Case",
    prefix: "CASE",
    subtitle: "Define the scope. Keep every investigation in context.",
    fields: [
      field("caseNumber", "Case number"),
      field("type", "Case type"),
      field("jurisdiction", "Jurisdiction"),
      status(["active", "paused", "closed", "archived"]),
      priority,
      field("summary", "Summary", "textarea"),
      field("objective", "Objective", "textarea"),
      field("authority", "Investigating authority"),
      field("officialReference", "Official reference"),
      tags,
    ],
  },
  evidence: {
    label: "Evidence",
    singular: "Evidence",
    prefix: "E",
    subtitle: "Preserve observations, provenance, and the confidence behind each claim.",
    fields: [
      description,
      field("type", "Evidence type", "select", [
        "image",
        "video",
        "document",
        "webpage",
        "social media",
        "official record",
        "map",
        "screenshot",
        "communication",
        "other",
      ]),
      links("sources", "Sources"),
      field("url", "Original URL", "url"),
      reliability,
      confidence,
      field("observed", "Date observed (UTC)", "datetime-local"),
      field("collected", "Date collected (UTC)", "datetime-local"),
      links("entities", "Linked entities"),
      links("locations", "Linked locations"),
      links("hypotheses", "Linked hypotheses"),
      links("timeline", "Linked timeline events"),
      notes,
      tags,
    ],
  },
  entities: {
    label: "Entities",
    singular: "Entity",
    prefix: "ENT",
    subtitle: "People, infrastructure, and objects that connect the investigation.",
    fields: [
      field("type", "Entity type", "select", [
        "person",
        "organization",
        "username",
        "phone",
        "email",
        "domain",
        "IP address",
        "cryptocurrency address",
        "social account",
        "vehicle",
        "location",
        "device",
        "event",
        "custom entity",
      ]),
      field("aliases", "Aliases"),
      description,
      field("attributes", "Attributes (key: value, one per line)", "textarea"),
      links("evidence", "Linked evidence"),
      links("entities", "Linked entities"),
      notes,
      tags,
      confidence,
    ],
  },
  timeline: {
    label: "Timeline",
    singular: "Event",
    prefix: "EV",
    subtitle: "Reconstruct the sequence. Separate observation from inference.",
    fields: [
      {
        ...field("timestamp", "Timestamp (UTC)", "datetime-local"),
        required: true,
      },
      field("endTimestamp", "End timestamp (UTC)", "datetime-local"),
      description,
      links("locations", "Locations"),
      links("entities", "Linked entities"),
      links("evidence", "Linked evidence"),
      confidence,
      links("sources", "Sources"),
      tags,
    ],
  },
  locations: {
    label: "Locations",
    singular: "Location",
    prefix: "LOC",
    subtitle: "Place observations in their geographic context.",
    fields: [
      description,
      { ...field("latitude", "Latitude", "number"), required: true },
      { ...field("longitude", "Longitude", "number"), required: true },
      field("category", "Category", "select", [
        "observation",
        "infrastructure",
        "route point",
        "area of interest",
      ]),
      links("evidence", "Linked evidence"),
      links("timeline", "Linked events"),
      tags,
    ],
  },
  leads: {
    label: "Leads",
    singular: "Lead",
    prefix: "L",
    subtitle: "Turn unanswered questions into deliberate next actions.",
    fields: [
      description,
      priority,
      status(["open", "investigating", "verified", "discarded", "closed"]),
      links("entities", "Linked entities"),
      links("evidence", "Linked evidence"),
      field("nextAction", "Next action", "textarea"),
      tags,
    ],
  },
  hypotheses: {
    label: "Hypotheses",
    singular: "Hypothesis",
    prefix: "H",
    subtitle:
      "Test competing explanations against supporting and contradicting evidence.",
    fields: [
      description,
      confidence,
      status(["open", "supported", "weakened", "rejected", "confirmed"]),
      links("evidence", "Supporting evidence", "supporting"),
      links("evidence", "Contradicting evidence", "contradicting"),
      links("entities", "Linked entities"),
      links("timeline", "Linked events"),
      notes,
      tags,
    ],
  },
  gaps: {
    label: "Information Gaps",
    singular: "Information gap",
    prefix: "IG",
    subtitle: "Make the unknowns explicit. Identify how to resolve them.",
    fields: [
      description,
      priority,
      status(["open", "researching", "resolved", "irrelevant"]),
      field("importance", "Why it matters", "textarea"),
      links("evidence", "Related evidence"),
      links("entities", "Related entities"),
      field("methods", "Possible methods", "textarea"),
      field("answer", "Answer", "textarea"),
      field("resolutionDate", "Resolution date", "date"),
      tags,
    ],
  },
  sources: {
    label: "Sources",
    singular: "Source",
    prefix: "S",
    subtitle: "Track original sources and assess their reliability.",
    fields: [
      field("url", "URL", "url"),
      field("publisher", "Publisher"),
      field("author", "Author"),
      field("publicationDate", "Publication date", "date"),
      field("accessDate", "Access date", "date"),
      reliability,
      field("archivedUrl", "Archived URL", "url"),
      notes,
      links("evidence", "Linked evidence"),
      links("cases", "Linked cases"),
    ],
  },
  tools: {
    label: "OSINT Tools",
    singular: "Tool",
    prefix: "T",
    subtitle: "Your curated reference desk for public-source research.",
    fields: [
      field("category", "Category", "select", [
        "General Search",
        "Username",
        "Email",
        "Phone",
        "Domain / DNS",
        "IP / Infrastructure",
        "Social Media",
        "Image",
        "Reverse Image Search",
        "Geolocation",
        "Maps",
        "Satellite",
        "Archives",
        "Corporate Records",
        "People Search",
        "Cryptocurrency",
        "Dark Web",
        "Metadata",
        "Documents",
        "Transportation",
        "Aviation",
        "Maritime",
        "RF / Spectrum",
        "Cybersecurity",
        "Threat Intelligence",
        "Other",
      ]),
      { ...field("url", "URL", "url"), required: true },
      description,
      notes,
      tags,
      field("pricing", "Pricing", "select", ["free", "paid", "freemium"]),
      field("account", "Requires account", "select", ["no", "yes", "optional"]),
      field("favorite", "Favorite", "select", ["no", "yes"]),
      field("lastUsed", "Last used (UTC)", "datetime-local"),
    ],
  },
  notes: {
    label: "Notes",
    singular: "Note",
    prefix: "N",
    subtitle: "Working notes and analytical context.",
    fields: [
      description,
      links("evidence", "Linked evidence"),
      links("entities", "Linked entities"),
      tags,
    ],
  },
};
export const relationshipTypes = [
  "SEEN_AT",
  "OWNS",
  "USES",
  "ASSOCIATED_WITH",
  "COMMUNICATED_WITH",
  "MENTIONS",
  "LOCATED_AT",
  "CONNECTED_TO",
  "SUPPORTS",
  "CONTRADICTS",
  "SOURCE_FOR",
  "ROUTE",
  "EVIDENCE_FOR",
  "CASE_REFERENCE",
  "CUSTOM",
];
