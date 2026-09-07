import { APP_VERSION, SCHEMA_VERSION } from "../models/schema";
import { useState } from "react";
import { Download, Upload, ShieldCheck, Database } from "lucide-react";
import { db } from "../db/database";
import {
  createBackup,
  download,
  importBackup,
  validateBackup,
  type Backup,
} from "../utils/backup";
export function Settings({
  caseId,
  onError,
  onSuccess,
}: {
  caseId: string;
  onError: (s: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [pending, setPending] = useState<Backup>();
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState("");
  const exportData = async (single = false) => {
    setBusy(true);
    try {
      download(
        JSON.stringify(await createBackup(single ? caseId : undefined), null, 2),
        `TRACE-${single ? "case" : "backup"}-${new Date().toISOString().slice(0, 10)}.json`,
      );
      onSuccess("Backup exported. Store it securely.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-grid">
      <section className="panel">
        <ShieldCheck size={26} />
        <span className="eyebrow">LOCAL DATA</span>
        <h2>Storage on this device</h2>
        <p>
          Your cases and attachments live in IndexedDB in this browser profile. TRACE has
          no accounts, analytics, cloud database, or automatic investigation uploads.
        </p>
        <p>
          Clearing site data, private browsing, a different browser, or a different site
          address can make your workspace unavailable. This storage is not encrypted by
          TRACE. Protect the device and retain independent evidence originals.
        </p>
        <button
          onClick={async () => {
            try {
              const persistent = await navigator.storage?.persist();
              const estimate = await navigator.storage?.estimate();
              setStorage(
                `${persistent ? "Persistent storage granted" : "Persistence not granted"} · ${((estimate?.usage ?? 0) / 1048576).toFixed(1)} MB used of ${((estimate?.quota ?? 0) / 1048576).toFixed(0)} MB quota.`,
              );
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Request persistent storage
        </button>
        {storage && <p role="status">{storage}</p>}
      </section>
      <section className="panel">
        <Database size={26} />
        <span className="eyebrow">BACKUP & RESTORE</span>
        <h2>Keep an independent copy</h2>
        <p className="mono">
          Application {APP_VERSION} · Schema {SCHEMA_VERSION}
        </p>
        <p>
          Versioned JSON includes records, links, history, and attachment bytes with
          SHA-256 checks. Exports may contain sensitive information.
        </p>
        <div className="stack">
          <button disabled={busy} onClick={() => void exportData()}>
            <Download size={16} /> Export entire database
          </button>
          <button disabled={busy || !caseId} onClick={() => void exportData(true)}>
            <Download size={16} /> Export active case
          </button>
          <label className="button">
            <Upload size={16} /> Choose JSON backup
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                try {
                  if (file) {
                    if (file.size > 100 * 1024 * 1024)
                      throw new Error("Import limit is 100 MB.");
                    setPending(validateBackup(JSON.parse(await file.text())));
                  }
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Invalid backup.");
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {pending && (
          <div className="import-preview">
            <h3>Review import</h3>
            <p>
              {pending.records.length} records · {pending.relationships.length}{" "}
              relationships · {pending.attachments.length} files.
            </p>
            <p>
              Imports add records atomically. Overlapping record IDs are rejected to avoid
              overwriting existing work.
            </p>
            <button
              disabled={busy}
              className="primary"
              onClick={async () => {
                setBusy(true);
                try {
                  await importBackup(pending);
                  setPending(undefined);
                  onSuccess("Backup imported.");
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Import failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import backup
            </button>
            <button onClick={() => setPending(undefined)}>Cancel</button>
          </div>
        )}
      </section>
      <section className="panel full danger-zone">
        <span className="eyebrow">DANGER ZONE</span>
        <h2>Start with an empty workspace</h2>
        <p>
          This removes all local cases, tools, files, and history. Export a backup first.
          The fictional demo will not be re-created automatically.
        </p>
        <button
          className="danger"
          onClick={async () => {
            if (
              prompt(
                "Type DELETE to clear every local record. This cannot be undone without a backup.",
              ) === "DELETE"
            ) {
              try {
                await db.transaction("rw", db.tables, async () => {
                  for (const table of db.tables) await table.clear();
                  await db.meta.put({ id: "initialized", value: "1" });
                });
                onSuccess("Workspace cleared.");
              } catch (e) {
                onError(String(e));
              }
            }
          }}
        >
          Clear workspace
        </button>
      </section>
    </div>
  );
}
