import type { InvestigationTime } from "../models/time";
export function timeLabel(time?: InvestigationTime): string {
  if (!time) return "Time not recorded";
  const format = (value: string) =>
    time.precision === "day" || time.qualifier === "date-only"
      ? value.slice(0, 10)
      : value
          .replace("T", " · ")
          .replace(/:00\.000Z$/, " UTC")
          .replace(/Z$/, " UTC");
  const prefix = {
    exact: "",
    approximate: "Approximately ",
    "date-only": "Date only · ",
    before: "Before ",
    after: "After ",
    range: "Range · ",
  }[time.qualifier];
  return `${prefix}${format(time.start)}${time.end ? ` → ${format(time.end)}` : ""}${time.uncertaintyMs ? ` (±${time.uncertaintyMs / 60000} min)` : ""}`;
}
export function elapsedLabel(
  previous?: InvestigationTime,
  next?: InvestigationTime,
): string | undefined {
  if (!previous || !next || previous.precision === "day" || next.precision === "day")
    return;
  // Bounds and approximate observations cannot establish a precise elapsed interval.
  if (
    !["exact", "range"].includes(previous.qualifier) ||
    !["exact", "range"].includes(next.qualifier)
  )
    return;
  const hours =
    (Date.parse(next.start) - Date.parse(previous.end ?? previous.start)) / 3600000;
  if (hours < 0.5) return;
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const remaining = totalMinutes % 1440;
  const wholeHours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  const parts = [
    days ? `${days}d` : "",
    wholeHours ? `${wholeHours}h` : "",
    minutes ? `${minutes}m` : "",
  ].filter(Boolean);
  return `${parts.join(" ")} gap`;
}
