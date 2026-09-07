import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { saveRelationship, deleteRelationship } from "../db/database";
import { relationshipTypes, type Relationship } from "../models/schema";
import type { RecordView } from "../presentation/records";
export function RelationshipDialog({
  records,
  caseId,
  existing,
  route = false,
  onClose,
  onError,
}: {
  records: RecordView[];
  caseId: string;
  existing?: Relationship;
  route?: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [from, setFrom] = useState(existing?.from ?? "");
  const [to, setTo] = useState(existing?.to ?? "");
  const [type, setType] = useState(
    existing?.type ?? (route ? "ROUTE" : "ASSOCIATED_WITH"),
  );
  const [confidence, setConfidence] = useState<Relationship["confidence"]>(
    existing?.confidence,
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [url, setUrl] = useState(existing?.provenance?.url ?? "");
  const [description, setDescription] = useState(existing?.provenance?.description ?? "");
  const [sourceId, setSourceId] = useState(existing?.sourceId ?? "");
  const [evidence, setEvidence] = useState(existing?.supportingEvidenceIds ?? []);
  const [busy, setBusy] = useState(false);
  const options = records.filter(
    (r) => r.kind !== "tools" && (!route || r.kind === "locations"),
  );
  return (
    <ModalShell className="relationship-dialog" onClose={onClose}>
      <header>
        <h2>
          {existing
            ? "Relationship details"
            : route
              ? "Connect locations"
              : "Create relationship"}
        </h2>
        <button className="icon-button" aria-label="Close relationship" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <form
        className="relationship-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await saveRelationship(
              {
                ...existing,
                caseId,
                from,
                to,
                type: type.trim(),
                confidence,
                notes,
                sourceId: sourceId || undefined,
                supportingEvidenceIds: evidence,
                provenance: {
                  url: url || undefined,
                  description: description || undefined,
                },
              },
              existing,
            );
            onClose();
          } catch (error) {
            onError(String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          { label: "From record", value: from, set: setFrom },
          { label: "To record", value: to, set: setTo },
        ].map((field) => (
          <label key={field.label}>
            {field.label}
            <select
              required
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
            >
              <option value="">Choose record</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.title}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Relationship type
          <input
            required
            list="relationship-types"
            value={type}
            readOnly={route}
            onChange={(e) => setType(e.target.value)}
          />
          <datalist id="relationship-types">
            {relationshipTypes
              .filter((t) => t !== "CUSTOM")
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </datalist>
        </label>
        <label>
          Confidence
          <select
            value={confidence ?? ""}
            onChange={(e) =>
              setConfidence((e.target.value as Relationship["confidence"]) || undefined)
            }
          >
            <option value="">Not assessed</option>
            {["confirmed", "high", "moderate", "low", "speculative"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Analyst notes
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Provenance URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Provenance description
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Source
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">No source selected</option>
            {records
              .filter((r) => r.kind === "sources")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.title}
                </option>
              ))}
          </select>
        </label>
        <fieldset>
          <legend>Supporting evidence</legend>
          {records
            .filter((r) => r.kind === "evidence")
            .map((r) => (
              <label className="check" key={r.id}>
                <input
                  type="checkbox"
                  checked={evidence.includes(r.id)}
                  onChange={(e) =>
                    setEvidence(
                      e.target.checked
                        ? [...evidence, r.id]
                        : evidence.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.code} · {r.title}
              </label>
            ))}
        </fieldset>
        {existing && (
          <small className="mono">
            Created {existing.createdAt}
            <br />
            Updated {existing.updatedAt}
            {existing.legacyIds?.length
              ? ` · ${existing.legacyIds.length} legacy references retained`
              : ""}
          </small>
        )}
        {route && (
          <p className="muted">
            An analyst-defined connection between locations, not a verified travel path.
          </p>
        )}
        <div className="actions">
          <button disabled={busy} className="primary">
            {existing ? "Save relationship" : "Link records"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        {existing && (
          <details className="relationship-danger">
            <summary>Danger zone</summary>
            <button
              disabled={busy}
              type="button"
              className="danger"
              onClick={async () => {
                if (confirm(`Remove ${existing.type} relationship?`)) {
                  try {
                    await deleteRelationship(existing.id);
                    onClose();
                  } catch (error) {
                    onError(String(error));
                  }
                }
              }}
            >
              <Trash2 size={14} /> Delete relationship
            </button>
          </details>
        )}
      </form>
    </ModalShell>
  );
}
