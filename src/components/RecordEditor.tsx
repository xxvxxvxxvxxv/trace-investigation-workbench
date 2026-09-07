import { ModalShell } from "./ModalShell";
import type { LinkSelection } from "../models/schema";
import type { DraftValues } from "../presentation/records";
import type { RecordView } from "../presentation/records";
import { useState, type ComponentProps } from "react";
import { X } from "lucide-react";
import { definitions, type Kind } from "../models/schema";
import { saveDraft } from "../presentation/saveDraft";
export function RecordEditorContent({
  kind,
  caseId,
  records,
  existing,
  initial,
  onClose,
  onSaved,
}: {
  kind: Kind;
  caseId: string;
  records: RecordView[];
  existing?: RecordView;
  initial?: DraftValues;
  onClose: () => void;
  onSaved: (r: RecordView) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [values, setDraftValues] = useState<DraftValues>(
    () =>
      existing?.values ?? {
        ...Object.fromEntries(
          definitions[kind].fields
            .filter((f) => f.type === "select")
            .map((f) => [
              f.key,
              ["confidence", "reliability"].includes(f.key) ? "" : (f.options?.[0] ?? ""),
            ]),
        ),
        ...initial,
      },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<LinkSelection>(() => existing?.links ?? {});
  const set = (key: string, value: string) =>
    setDraftValues((v) => ({ ...v, [key]: value }));
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onSaved(await saveDraft(kind, caseId, title, values, existing, links));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save record.");
            setBusy(false);
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">{existing?.code ?? "NEW RECORD"}</span>
            <h2>
              {existing ? "Edit" : "Add"} {definitions[kind].singular.toLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close editor"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="form-body">
          <label className="full">
            {kind === "hypotheses" ? "Statement" : kind === "gaps" ? "Question" : "Title"}{" "}
            *
            <input
              required
              autoFocus
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="form-grid">
            {definitions[kind].fields.map((f) => (
              <label
                className={f.type === "textarea" || f.type === "links" ? "full" : ""}
                key={f.key}
              >
                {f.label}
                {f.required ? " *" : ""}
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  >
                    {["confidence", "reliability"].includes(f.key) && (
                      <option value="">Not assessed</option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "links" ? (
                  <div className="link-picker">
                    {records
                      .filter(
                        (r) =>
                          r.kind === f.target &&
                          (r.kind === "cases" || r.caseId === caseId) &&
                          r.id !== existing?.id,
                      )
                      .map((r) => (
                        <label className="check" key={r.id}>
                          <input
                            type="checkbox"
                            checked={(links[f.key] ?? []).includes(r.id)}
                            onChange={(e) =>
                              setLinks((current) => ({
                                ...current,
                                [f.key]: e.target.checked
                                  ? [...(current[f.key] ?? []), r.id]
                                  : (current[f.key] ?? []).filter((id) => id !== r.id),
                              }))
                            }
                          />
                          <span>
                            <small>{r.code}</small> {r.title}
                          </span>
                        </label>
                      ))}
                    {!records.some(
                      (r) =>
                        r.kind === f.target &&
                        (r.kind === "cases" || r.caseId === caseId) &&
                        r.id !== existing?.id,
                    ) && (
                      <small>No {definitions[f.target!].label.toLowerCase()} yet.</small>
                    )}
                  </div>
                ) : (
                  <input
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "any" : undefined}
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save record"}
          </button>
        </footer>
      </form>
    </>
  );
}

export function RecordEditor(props: ComponentProps<typeof RecordEditorContent>) {
  return (
    <ModalShell className="editor" onClose={props.onClose}>
      <RecordEditorContent {...props} />
    </ModalShell>
  );
}
