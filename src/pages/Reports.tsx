import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Printer } from "lucide-react";
import type { RecordView } from "../presentation/records";
import { definitions, APP_VERSION, type Kind } from "../models/schema";
import { db } from "../db/database";
import { TraceBrand } from "../components/TraceBrand";
import { timeLabel } from "../presentation/timeline";
export function Reports({
  activeCase,
  records,
}: {
  activeCase?: RecordView;
  records: RecordView[];
}) {
  const files =
    useLiveQuery(
      () =>
        activeCase ? db.attachments.where("caseId").equals(activeCase.id).toArray() : [],
      [activeCase?.id],
    ) ?? [];
  const [generated] = useState(() => new Date().toISOString());
  if (!activeCase)
    return (
      <div className="empty">
        <TraceBrand />
        <h2>Select a case to prepare a report</h2>
        <p>Create a case in Cases, then capture evidence and sources.</p>
      </div>
    );
  const sections: { kind: Kind; title: string }[] = [
    { kind: "timeline", title: "Timeline" },
    { kind: "evidence", title: "Evidence register" },
    { kind: "entities", title: "Entities" },
    { kind: "hypotheses", title: "Hypotheses" },
    { kind: "gaps", title: "Information gaps" },
    { kind: "sources", title: "Sources" },
  ];
  return (
    <>
      <div className="toolbar no-print">
        <p className="muted">
          Review your recorded assessments, then print or save as PDF.
        </p>
        <button className="primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print / Save PDF
        </button>
      </div>
      <article className="report">
        <div className="report-top">
          <TraceBrand />
          <span className="eyebrow">
            ANALYST REPORT
            <br />
            {activeCase.values.caseNumber || activeCase.code}
          </span>
        </div>
        <span className="eyebrow">CASE REPORT</span>
        <h1>{activeCase.title}</h1>
        <div className="report-meta">
          <span>{activeCase.code}</span>
          <span>Status: {activeCase.values.status || "Not recorded"}</span>
          <span>Generated: {generated}</span>
        </div>
        <section>
          <h2>01 / Case overview</h2>
          <p>{activeCase.values.summary || "No case summary recorded."}</p>
          <h3>Objective</h3>
          <p>{activeCase.values.objective || "No objective recorded."}</p>
          <h3>Key case metadata</h3>
          {["type", "jurisdiction", "priority", "authority", "officialReference"]
            .filter((k) => activeCase.values[k])
            .map((k) => (
              <p key={k}>
                <strong>
                  {definitions.cases.fields.find((f) => f.key === k)?.label}:{" "}
                </strong>
                {activeCase.values[k]}
              </p>
            ))}
        </section>
        {sections.map(({ kind, title }, index) => (
          <section key={kind}>
            <h2>
              {String(index + 2).padStart(2, "0")} / {title}
            </h2>
            {records
              .filter((r) => r.kind === kind)
              .sort((a, b) =>
                kind === "timeline"
                  ? (a.record.values.time?.start ?? "").localeCompare(
                      b.record.values.time?.start ?? "",
                    )
                  : a.code.localeCompare(b.code),
              )
              .map((r) => (
                <div className="report-record" key={r.id}>
                  <h3>
                    <code>{r.code}</code> · {r.title}
                  </h3>
                  {r.record.values.time && (
                    <p>
                      <strong>Time: </strong>
                      {timeLabel(r.record.values.time)}
                    </p>
                  )}
                  {definitions[kind].fields
                    .filter(
                      (f) =>
                        !["timestamp", "endTimestamp"].includes(f.key) &&
                        (f.type === "links" ? r.links[f.key]?.length : r.values[f.key]),
                    )
                    .map((f) => (
                      <p key={f.key}>
                        <strong>{f.label}: </strong>
                        {f.type === "links"
                          ? (r.links[f.key] ?? [])
                              .map((id) => {
                                const target =
                                  records.find((item) => item.id === id) ??
                                  (activeCase.id === id ? activeCase : undefined);
                                return target
                                  ? `${target.code} — ${target.title}`
                                  : "Unavailable";
                              })
                              .join("; ")
                          : r.values[f.key]}
                      </p>
                    ))}
                </div>
              ))}
            {!records.some((r) => r.kind === kind) && (
              <p>No {title.toLowerCase()} recorded.</p>
            )}
          </section>
        ))}
        <section>
          <h2>08 / Attachment & hash appendix</h2>
          <p>
            SHA-256 values describe the stored bytes. They do not establish authenticity
            or a legal chain of custody.
          </p>
          {files.map((file) => (
            <div className="hash-entry" key={file.id}>
              <strong>
                {records.find((r) => r.id === file.recordId)?.code || activeCase.code} ·{" "}
                {file.name}
              </strong>
              <p>
                {file.mime || "Unknown media type"} · {file.size.toLocaleString()} bytes ·
                Added {file.createdAt}
              </p>
              <code>SHA-256 {file.sha256}</code>
            </div>
          ))}
          {!files.length && <p>No local attachments recorded.</p>}
        </section>
        <footer>
          <strong>TRACE · Open-Source Investigation Workbench</strong>
          <br />
          Analyst-generated report · v{APP_VERSION}
          <br />
          Confidence and source reliability reflect recorded analyst assessments. Preserve
          original evidence and review this report before sharing.
        </footer>
      </article>
    </>
  );
}
