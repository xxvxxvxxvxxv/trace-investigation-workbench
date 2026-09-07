export type UTCInstant = string & { readonly __utcInstant: unique symbol };
export type TimeQualifier =
  "exact" | "approximate" | "date-only" | "before" | "after" | "range";
export interface InvestigationTime {
  start: UTCInstant;
  end?: UTCInstant;
  precision: "millisecond" | "second" | "minute" | "day";
  qualifier: TimeQualifier;
  uncertaintyMs?: number;
  originalInput?: string;
  originalEndInput?: string;
  assumedTimezone?: "UTC";
}
export function normalizeInstant(value: string): UTCInstant {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!m) throw new Error("Timestamp requires an explicit Z or numeric timezone offset.");
  const [, year, month, day, hour, minute, second, , offset] = m;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > days ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second ?? 0) > 59
  )
    throw new Error("Invalid timestamp calendar components.");
  if (
    offset !== "Z" &&
    (Number(offset.slice(1, 3)) > 14 ||
      Number(offset.slice(4)) > 59 ||
      (Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0))
  )
    throw new Error("Invalid timezone offset.");
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error("Invalid timestamp.");
  return date.toISOString() as UTCInstant;
}
export const nowUTC = () => new Date().toISOString() as UTCInstant;
export function assertUTC(value: unknown): asserts value is UTCInstant {
  if (typeof value !== "string" || normalizeInstant(value) !== value)
    throw new Error("Timestamp must be a canonical UTC instant.");
}
export function validateTime(time: InvestigationTime) {
  assertUTC(time.start);
  if (time.end !== undefined) {
    assertUTC(time.end);
    if (time.end < time.start) throw new Error("End time must follow the start time.");
  }
  if (
    !["exact", "approximate", "date-only", "before", "after", "range"].includes(
      time.qualifier,
    ) ||
    !["millisecond", "second", "minute", "day"].includes(time.precision)
  )
    throw new Error("Invalid investigation time metadata.");
  if (time.qualifier === "range" && !time.end)
    throw new Error("Time range requires an end.");
  if (
    time.qualifier === "date-only" &&
    (time.precision !== "day" || !time.start.endsWith("T00:00:00.000Z") || time.end)
  )
    throw new Error("Date-only time requires a UTC day boundary.");
  if (["before", "after"].includes(time.qualifier) && time.end)
    throw new Error("Before/after time cannot include an end.");
  if (
    time.uncertaintyMs !== undefined &&
    (!Number.isFinite(time.uncertaintyMs) || time.uncertaintyMs < 0)
  )
    throw new Error("Invalid time uncertainty.");
  if (time.assumedTimezone !== undefined && time.assumedTimezone !== "UTC")
    throw new Error("Invalid assumed timezone.");
  for (const input of [time.originalInput, time.originalEndInput])
    if (input !== undefined && typeof input !== "string")
      throw new Error("Invalid original time input.");
}
export function exactTime(start: string, end?: string): InvestigationTime {
  const time: InvestigationTime = {
    start: normalizeInstant(start),
    precision: "minute",
    qualifier: end ? "range" : "exact",
    ...(end ? { end: normalizeInstant(end) } : {}),
  };
  validateTime(time);
  return time;
}
export function inputAsUTC(value: string) {
  return normalizeInstant(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}
export function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid calendar date.");
  normalizeInstant(`${value}T00:00:00Z`);
}
