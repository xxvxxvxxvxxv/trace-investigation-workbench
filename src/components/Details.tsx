import { Badge } from "../pages/RecordList";
import { timeLabel } from "../presentation/timeline";
import { ModalShell } from "./ModalShell";
import type { RecordView } from "../presentation/records";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, type ComponentProps } from "react";
import { X, Pencil, Download, Paperclip, Trash2 } from "lucide-react";
import { addAttachment, db, deleteRecord } from "../db/database";
import { definitions, type Attachment } from "../models/schema";
import { download } from "../utils/backup";
function FilePreview({ file }: { file: Attachment }) {
  const preview = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file.blob);
    if (preview.current) preview.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file.blob]);
  return (
    <div className="attachment">
      {["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mime) && (
        <img ref={preview} alt={file.name} />
      )}
      <strong>{file.name}</strong>
      <small>{(file.size / 1024).toFixed(1)} KB · SHA-256</small>
      <code>{file.sha256}</code>
      <div className="actions">
        <button onClick={() => download(file.blob, file.name)}>
          <Download size={14} /> Download
        </button>
        <button
          aria-label={`Remove ${file.name}`}
          onClick={() => {
            if (confirm("Remove this local attachment?"))
              void db.attachments.delete(file.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
export function RecordDetailContent({
  record,
  records,
  onClose,
  onEdit,
  onSelect,
  onError,
}: {
  record: RecordView;
  records: RecordView[];
  onClose: () => void;
  onEdit: () => void;
  onSelect: (r: RecordView) => void;
  onError: (s: string) => void;
}) {
  const relationships =
    useLiveQuery(
      () =>
        db.relationships
          .filter((r) => r.from === record.id || r.to === record.id)
          .toArray(),
      [record.id],
    ) ?? [];
  const files =
    useLiveQuery(
      () => db.attachments.where("recordId").equals(record.id).toArray(),
      [record.id],
    ) ?? [];
  const visibleFields = definitions[record.kind].fields.filter((f) =>
    f.type === "links" ? record.links[f.key]?.length : record.values[f.key],
  );
  const provenanceKeys = new Set([
    "sources",
    "url",
    "reliability",
    "observed",
    "collected",
  ]);
  const linkedFields = visibleFields.filter((f) => f.type === "links");
  const provenanceFields = visibleFields.filter((f) => provenanceKeys.has(f.key));
  const overviewFields = visibleFields.filter(
    (f) => !provenanceKeys.has(f.key) && f.type !== "links",
  );
  const renderFields = (fields: typeof visibleFields) => (
    <dl>
      {fields.map((f) => (
        <div key={f.key}>
          <dt>{f.label}</dt>
          <dd>
            {f.type === "links" ? (
              (record.links[f.key] ?? []).map((id) => {
                const r = records.find((r) => r.id === id);
                return r ? (
                  <button className="linked" key={id} onClick={() => onSelect(r)}>
                    {r.code} · {r.title}
                  </button>
                ) : (
                  <span key={id}>Unavailable record</span>
                );
              })
            ) : f.type === "url" ? (
              <a href={record.values[f.key]} target="_blank" rel="noreferrer">
                {record.values[f.key]}
              </a>
            ) : (
              String(record.values[f.key])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <>
      <header>
        <span className="eyebrow">
          {record.code} / {definitions[record.kind].singular}
        </span>
        <button className="icon-button" aria-label="Close details" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="detail-body">
        <h2>{record.title}</h2>
        <div className="detail-badges">
          {[record.values.status, record.values.confidence, record.values.priority]
            .filter(Boolean)
            .map((v) => (
              <Badge key={v} value={v} />
            ))}
        </div>
        <div className="actions">
          <button onClick={onEdit}>
            <Pencil size={14} /> Edit record
          </button>
          <details className="danger-menu">
            <summary>More actions</summary>
            <button
              className="danger"
              onClick={async () => {
                if (
                  confirm(
                    `Delete ${record.code}${record.kind === "cases" ? " and ALL of its investigation records and attachments" : ""}? Export a backup first if needed.`,
                  )
                ) {
                  try {
                    await deleteRecord(record.record);
                    onClose();
                  } catch (e) {
                    onError(String(e));
                  }
                }
              }}
            >
              <Trash2 size={14} /> Delete record
            </button>
          </details>
        </div>
        {record.record.values.time && (
          <div className="time-assessment">
            <h3>Event time</h3>
            <span className="mono">{timeLabel(record.record.values.time)}</span>
            <p className="muted">Precision: {record.record.values.time.precision}</p>
          </div>
        )}
        {!!overviewFields.length && (
          <section className="inspector-section">
            <h3>Overview</h3>
            {renderFields(overviewFields)}
          </section>
        )}
        {!!provenanceFields.length && (
          <section className="inspector-section">
            <h3>Provenance</h3>
            {renderFields(provenanceFields)}
          </section>
        )}
        {!!linkedFields.length && (
          <section className="inspector-section">
            <h3>Linked records</h3>
            {renderFields(linkedFields)}
          </section>
        )}
        <section className="inspector-relations">
          <h3>
            Relationships <span className="muted">{relationships.length}</span>
          </h3>
          {relationships.map((rel) => {
            const target = records.find(
              (r) => r.id === (rel.from === record.id ? rel.to : rel.from),
            );
            return (
              target && (
                <button
                  className="relation-link"
                  key={rel.id}
                  onClick={() => onSelect(target)}
                >
                  <small>
                    {rel.from === record.id ? "→" : "←"} {rel.type.replaceAll("_", " ")}
                    {rel.confidence ? ` · ${rel.confidence}` : ""}
                  </small>
                  <span>
                    <code>{target.code}</code> · {target.title}
                  </span>
                  {rel.notes && <small>{rel.notes}</small>}
                </button>
              )
            );
          })}
          {!relationships.length && (
            <p className="muted">
              Link evidence, sources or entities when editing this record.
            </p>
          )}
        </section>
        <section className="inspector-section">
          <div className="section-heading">
            <h3>Attachments</h3>
            <label className="button">
              <Paperclip size={14} /> Add file
              <input
                className="sr-only"
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    try {
                      await addAttachment(record.record, f);
                    } catch (e) {
                      onError(
                        e instanceof Error ? e.message : "File could not be stored.",
                      );
                    }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {!files.length && (
            <p className="muted">No attachments stored for this record.</p>
          )}
          {files.map((f) => (
            <FilePreview file={f} key={f.id} />
          ))}
        </section>
        <div className="record-meta">
          <h3>Audit</h3>
          Created {new Date(record.createdAt).toLocaleString()}
          <br />
          Updated {new Date(record.updatedAt).toLocaleString()}
          <br />
          <code>{record.id}</code>
        </div>
      </div>
    </>
  );
}

export function Details(props: ComponentProps<typeof RecordDetailContent>) {
  return (
    <ModalShell className="detail" onClose={props.onClose}>
      <RecordDetailContent {...props} />
    </ModalShell>
  );
}
