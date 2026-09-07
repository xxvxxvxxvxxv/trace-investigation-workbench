import type { RecordView } from "../presentation/records";
import {
  ArrowUpRight,
  FolderOpen,
  Clock,
  FileText,
  Users,
  Compass,
  HelpCircle,
} from "lucide-react";
import { Timeline } from "../components/Timeline";
import { Graph } from "../features/Graph";
import { Badge } from "./RecordList";
import type { Relationship, Activity, Kind } from "../models/schema";
export function Dashboard({
  records,
  activeCase,
  relationships,
  activity,
  onSelect,
  onNavigate,
  onError,
}: {
  all: RecordView[];
  records: RecordView[];
  activeCase?: RecordView;
  relationships: Relationship[];
  activity: Activity[];
  onSelect: (r: RecordView) => void;
  onNavigate: (s: string) => void;
  onError: (s: string) => void;
}) {
  const count = (k: Kind) => records.filter((r) => r.kind === k).length;

  const metrics = [
    {
      label: "Evidence collected",
      number: count("evidence"),
      detail: "Source-linked observations",
      icon: FileText,
      path: "evidence",
    },
    {
      label: "Tracked entities",
      number: count("entities"),
      detail: "People & infrastructure",
      icon: Users,
      path: "entities",
    },
    {
      label: "Open leads",
      number: records.filter(
        (r) => r.kind === "leads" && ["open", "investigating"].includes(r.values.status),
      ).length,
      detail: "Next steps to investigate",
      icon: Compass,
      path: "leads",
    },
    {
      label: "Unresolved gaps",
      number: records.filter(
        (r) => r.kind === "gaps" && ["open", "researching"].includes(r.values.status),
      ).length,
      detail: "Questions to resolve",
      icon: HelpCircle,
      path: "gaps",
    },
    {
      label: "Timeline events",
      number: count("timeline"),
      detail: "Recorded chronology",
      icon: Clock,
      path: "timeline",
    },
  ];
  return (
    <>
      {activeCase ? (
        <div className="case-banner">
          <div className="case-mark">
            <FolderOpen size={24} />
          </div>
          <div>
            <span className="eyebrow">
              CURRENT INVESTIGATION · {activeCase.values.caseNumber || activeCase.code}
            </span>
            <button className="text-button" onClick={() => onSelect(activeCase)}>
              <h2>{activeCase.title}</h2>
            </button>
            <p>{activeCase.values.objective || activeCase.values.summary}</p>
          </div>
          <div className="case-banner-right">
            <Badge value={activeCase.values.status} />
            <Badge value={activeCase.values.priority} />
            <span className="muted">
              {activeCase.values.type} · {activeCase.values.jurisdiction}
            </span>
            <button onClick={() => onSelect(activeCase)}>
              Case brief <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">
          <h2>Your first investigation starts here.</h2>
          <p>Create a case to organize evidence and connect the facts.</p>
          <button onClick={() => onNavigate("cases")}>Open cases</button>
        </div>
      )}
      <div className="metrics">
        {metrics.map((m) => (
          <button className="metric" key={m.path} onClick={() => onNavigate(m.path)}>
            <span>
              <m.icon size={17} />
              {m.label}
            </span>
            <strong>{String(m.number).padStart(2, "0")}</strong>
            <small>{m.detail}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel graph-overview">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CONNECTIONS</span>
              <h2>Investigation graph</h2>
            </div>
            <button className="text-button muted" onClick={() => onNavigate("graph")}>
              Explore graph <ArrowUpRight size={14} />
            </button>
          </div>
          <Graph
            compact
            records={records}
            relationships={relationships}
            caseId={activeCase?.id ?? ""}
            onSelect={onSelect}
            onError={onError}
          />
        </section>
        <section className="panel recent-evidence">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COLLECTION</span>
              <h2>Recent intelligence</h2>
            </div>
            <button className="text-button muted" onClick={() => onNavigate("evidence")}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          {records
            .filter((r) => ["evidence", "entities", "sources"].includes(r.kind))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 4)
            .map((r) => (
              <button className="evidence-row" key={r.id} onClick={() => onSelect(r)}>
                <span className="document-icon">
                  <FileText size={19} />
                </span>
                <span>
                  <small className="mono">
                    {r.code} / {r.values.type}
                  </small>
                  <strong>{r.title}</strong>
                </span>
                <Badge value={r.values.confidence} />
                <ArrowUpRight size={16} />
              </button>
            ))}
          {!count("evidence") && <p className="muted">No evidence collected yet.</p>}
        </section>
        <section className="panel next-actions">
          <span className="eyebrow">RESEARCH QUEUE</span>
          <h2>Next actions</h2>
          {records
            .filter(
              (r) =>
                (r.kind === "leads" || r.kind === "gaps") &&
                ["open", "investigating", "researching"].includes(r.values.status),
            )
            .sort((a, b) => {
              const ranks: Record<string, number> = {
                critical: 0,
                high: 1,
                medium: 2,
                low: 3,
              };
              return (ranks[a.values.priority] ?? 4) - (ranks[b.values.priority] ?? 4);
            })
            .slice(0, 3)
            .map((r) => (
              <button key={r.id} className="next-action" onClick={() => onSelect(r)}>
                <span className="eyebrow">
                  {r.code} · {r.values.priority} priority
                </span>
                <strong>{r.title}</strong>
                <small>
                  {r.values.nextAction || r.values.methods || r.values.description}
                </small>
              </button>
            ))}
          {!records.some(
            (r) =>
              (r.kind === "leads" || r.kind === "gaps") &&
              ["open", "investigating", "researching"].includes(r.values.status),
          ) && <p className="muted">No open research actions.</p>}
        </section>
        <section className="panel timeline-snapshot">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CHRONOLOGY</span>
              <h2>Timeline snapshot</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("timeline")}>
              Open timeline <ArrowUpRight size={14} />
            </button>
          </div>
          <Timeline
            compact
            records={records
              .filter((r) => r.kind === "timeline")
              .sort((a, b) =>
                (a.values.timestamp ?? "").localeCompare(b.values.timestamp ?? ""),
              )
              .slice(0, 4)}
            onSelect={onSelect}
          />
        </section>
        <section className="panel activity-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CASE ACTIVITY</span>
              <h2>Activity log</h2>
            </div>
            <span className="badge">LOCAL</span>
          </div>
          <div className="activity-list">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id}>
                <i />
                <p>
                  {a.description}
                  <small>
                    {new Date(a.timestamp).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </p>
              </div>
            ))}
            {!activity.length && (
              <p className="muted">Your case activity will appear here.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
