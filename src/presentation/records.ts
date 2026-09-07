import {
  definitions,
  type Kind,
  type Values,
  type RecordItem,
  type Relationship,
  type LinkSelection,
} from "../models/schema";
import { inputAsUTC } from "../models/time";
import { projectLinks } from "../models/relations";
export type DraftValues = Record<string, string>;
export interface RecordView extends Omit<RecordItem, "values"> {
  values: DraftValues;
  links: LinkSelection;
  record: RecordItem;
}
export function valuesToDraft(values: Values): DraftValues {
  const result: DraftValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "time") continue;
    result[key] =
      value === undefined
        ? ""
        : Array.isArray(value)
          ? value.join(", ")
          : typeof value === "boolean"
            ? value
              ? "yes"
              : "no"
            : typeof value === "object"
              ? Object.entries(value)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join("\n")
              : String(value);
    if (["observed", "collected", "lastUsed"].includes(key))
      result[key] = String(value).replace(/Z$/, "");
  }
  if (values.time) {
    result.timestamp = values.time.start.replace(/Z$/, "");
    if (values.time.end) result.endTimestamp = values.time.end.replace(/Z$/, "");
  }
  return result;
}
export function draftToValues(kind: Kind, draft: DraftValues, base: Values = {}): Values {
  const values: Values = { ...base };
  const previous = valuesToDraft(base);
  for (const field of definitions[kind].fields) {
    const key = field.key;
    if (field.type === "links" || ["timestamp", "endTimestamp"].includes(key)) continue;
    const raw = draft[key] ?? "";
    if (raw === previous[key]) continue;
    if (!raw) {
      delete values[key];
      continue;
    }
    if (["tags", "aliases"].includes(key)) {
      values[key] = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (key === "attributes") {
      const attributes: Record<string, string> = {};
      for (const line of raw.split("\n").filter(Boolean)) {
        const index = line.indexOf(":");
        const name = line.slice(0, index).trim();
        if (index < 1 || Object.hasOwn(attributes, name))
          throw new Error("Use one unique attribute name: value per line.");
        Object.defineProperty(attributes, name, {
          value: line.slice(index + 1).trim(),
          enumerable: true,
        });
      }
      values.attributes = attributes;
    } else if (["latitude", "longitude"].includes(key)) values[key] = Number(raw);
    else if (key === "favorite") values.favorite = raw === "yes";
    else if (["observed", "collected", "lastUsed"].includes(key))
      values[key] = inputAsUTC(raw);
    else values[key] = raw;
  }
  if (
    kind === "timeline" &&
    (draft.timestamp !== previous.timestamp ||
      draft.endTimestamp !== previous.endTimestamp)
  ) {
    if (draft.timestamp) {
      values.time = {
        ...(base.time ?? {}),
        start: inputAsUTC(draft.timestamp),
        precision: base.time?.precision ?? "minute",
        qualifier: draft.endTimestamp ? "range" : "exact",
      };
      delete values.time.end;
      delete values.time.originalInput;
      delete values.time.originalEndInput;
      delete values.time.assumedTimezone;
      if (draft.endTimestamp) values.time.end = inputAsUTC(draft.endTimestamp);
    } else delete values.time;
  }
  return values;
}
export function recordView(
  record: RecordItem,
  all: RecordItem[],
  relationships: Relationship[],
): RecordView {
  return {
    ...record,
    record,
    values: valuesToDraft(record.values),
    links: projectLinks(record, all, relationships),
  };
}
