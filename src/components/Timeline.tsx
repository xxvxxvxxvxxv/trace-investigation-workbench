import { Fragment } from "react";
import { MapPin, Paperclip } from "lucide-react";
import type { RecordView } from "../presentation/records";
import { timeLabel, elapsedLabel } from "../presentation/timeline";
import { Badge } from "../pages/RecordList";
export function Timeline({
  records,
  onSelect,
  selectedId,
  compact = false,
  descending = false,
}: {
  records: RecordView[];
  onSelect: (record: RecordView) => void;
  selectedId?: string;
  compact?: boolean;
  descending?: boolean;
}) {
  const events = records
    .filter((r) => r.kind === "timeline")
    .sort(
      (a, b) =>
        (descending ? -1 : 1) *
        (a.record.values.time?.start ?? "").localeCompare(
          b.record.values.time?.start ?? "",
        ),
    );
  return (
    <div className={`timeline-rail ${compact ? "timeline-compact" : ""}`}>
      {events.map((r, index) => {
        const time = r.record.values.time;
        const gap = descending
          ? elapsedLabel(time, events[index - 1]?.record.values.time)
          : elapsedLabel(events[index - 1]?.record.values.time, time);
        return (
          <Fragment key={r.id}>
            {gap && (
              <div className="temporal-gap">
                <span>{gap}</span>
              </div>
            )}
            <button
              className={`event-card ${time?.qualifier === "range" ? "event-range" : ""} ${selectedId === r.id ? "selected" : ""}`}
              onClick={() => onSelect(r)}
              aria-pressed={selectedId === r.id}
            >
              <time className="mono">{timeLabel(time)}</time>
              <div className="section-heading">
                <span className="mono">{r.code}</span>
                <Badge value={r.values.confidence} />
              </div>
              <h3>{r.title}</h3>
              {!compact && <p>{r.values.description}</p>}
              <div className="event-meta">
                <span>
                  <Paperclip size={14} />
                  {r.links.evidence?.length ?? 0} evidence
                </span>
                {!!r.links.locations?.length && (
                  <span>
                    <MapPin size={14} />
                    {r.links.locations.length} locations
                  </span>
                )}
                <span>{time?.qualifier ?? "unspecified"}</span>
              </div>
            </button>
          </Fragment>
        );
      })}
      {!events.length && (
        <p className="muted">Capture an event to start reconstructing the sequence.</p>
      )}
    </div>
  );
}
