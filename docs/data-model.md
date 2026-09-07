# TRACE v2 data model

Application: **0.2.1-beta**. IndexedDB schema: **2**. JSON backup format: **2**.

## Records and typed values

`RecordItem` retains its UUID, kind, owning case, display code, title, creation/update instants, and extensible values object. Cases own themselves; tools have an empty case ID and are workspace-wide. Other records belong to one existing case.

`Values` declares important fields explicitly:

| Field                               | Representation                                              |
| ----------------------------------- | ----------------------------------------------------------- |
| `tags`, `aliases`                   | String arrays                                               |
| `latitude`, `longitude`             | Finite numbers, bounded to ±90 / ±180                       |
| `favorite`                          | Boolean                                                     |
| `attributes`                        | Named string, number, or boolean values                     |
| `time`                              | InvestigationTime object                                    |
| `observed`, `collected`, `lastUsed` | Canonical UTC instant strings with branded TypeScript types |
| Other registered fields             | Validated strings, including date-only calendar fields      |
| Extension fields                    | Strings, finite numbers, booleans, or string arrays         |

Links are **not stored in `values`**. Link selections in the editor are `Record<string, string[]>` drafts. String-form values exist only in the presentation adapter and legacy migration boundary. A `RecordView` is a disposable projection, never a database record or backup payload.

## One authoritative relationship table

Every relationship is stored once in `relationships`:

```ts
interface Relationship {
  id: string;
  caseId: string;
  from: string;
  to: string;
  type: string;
  createdAt: UTCInstant;
  updatedAt: UTCInstant;
  confidence?: Confidence;
  notes?: string;
  supportingEvidenceIds?: string[];
  sourceId?: string;
  provenance?: { url?: string; description?: string };
  legacyIds?: string[];
  legacyFields?: { recordId: string; field: string }[];
}
```

Types remain extensible. `legacyIds` and `legacyFields` record migration origins only; they are not a second source of links. Optional supporting-evidence and source references describe the **relationship itself**, not the owning record.

The table indexes case, source, target, type, case/type, case/source, case/target, the identity tuple, supporting evidence IDs, and provenance source. The database service exposes incoming, outgoing, linked-record, and case/type queries. Both graph edits and form edits use the same service and table.

An identical relationship is the tuple `(caseId, from, to, type)`. Creation checks this tuple within a serialized IndexedDB write transaction. A concurrent duplicate is rejected. Import validates duplicate tuples before writing. The tuple index is deliberately non-unique so the v1 upgrade can read and coalesce legacy duplicates before enforcing the service invariant. Application code must use the mutation service rather than write directly to the table.

### Field semantics

| Form relationship               | Stored direction and type                       |
| ------------------------------- | ----------------------------------------------- |
| Supporting evidence             | Evidence → hypothesis, `SUPPORTS`               |
| Contradicting evidence          | Evidence → hypothesis, `CONTRADICTS`            |
| Source provenance               | Source → record, `SOURCE_FOR`                   |
| Source linked case              | Source → case, `CASE_REFERENCE`                 |
| Evidence and timeline           | Evidence → event, `EVIDENCE_FOR`                |
| Evidence and entity             | Evidence → entity, `MENTIONS`                   |
| Geographic association          | Record → location, `LOCATED_AT`                 |
| Other generic form associations | UUID-ordered endpoints, `CONNECTED_TO`          |
| Explicit graph relations        | Their declared direction and type are preserved |
| Route                           | Location → location, `ROUTE`                    |

Canonical endpoint ordering makes generic associations symmetric without storing duplicate reverse edges. A generic association does not imply ownership or a causal claim. Existing explicit `SEEN_AT`, `USES`, `OWNS`, `ASSOCIATED_WITH`, and other semantic edges retain their meanings.

Endpoints must exist in the owning case. The only cross-case exception is a source's explicit `CASE_REFERENCE` to another existing case, preserving a capability of v1. Tools cannot be relationship endpoints. Known special types validate endpoint kinds. Optional evidence/source metadata must reference existing records of the correct kind in the same case.

A form displays a projection of matching authoritative relationships. Clearing a checked link removes the corresponding edge, including an edge previously created in Graph. Saving unchanged links retains their timestamps and optional metadata. Graph deletion is immediately reflected in form projections.

## Investigation time

`InvestigationTime` stores a canonical UTC `start`, optional UTC `end`, precision (`millisecond`, `second`, `minute`, `day`), and qualifier (`exact`, `approximate`, `date-only`, `before`, `after`, `range`). Optional `uncertaintyMs` is a finite, nonnegative duration. Original input and an assumed timezone can be retained as metadata.

Core time parsing requires an explicit `Z` or numeric offset. It validates calendar components, normalizes offsets, and compares ranges after normalization. Impossible dates and reversed ranges are rejected. Date-only values use midnight UTC plus day precision; they are not claims that an event happened at midnight.

The existing datetime-local controls are explicitly interpreted as **UTC wall time** by the presentation adapter; they never inherit the browser's timezone. UTC-normalized storage is projected back into those controls. Advanced precision and uncertainty controls are deferred. Editing unrelated fields preserves existing time metadata and numeric/boolean attributes. Editing timestamps with the current controls creates an exact/range assessment.

## Automatic v1 → v2 upgrade

Dexie keeps the v1 schema declaration and registers a v2 upgrade transaction. Existing databases upgrade when opened; initialized demo workspaces are not reseeded.

The upgrade:

1. Validates legacy records and converts arrays, booleans, coordinates, attributes, and timestamps.
2. Moves every legacy link field into the authoritative relationship table using the mapping above.
3. Preserves explicit edge UUIDs and types; coalesces identical edges while retaining all original edge IDs and field origins.
4. Removes migrated link fields from stored values.
5. Rebuilds counter scopes and retains their high-water marks, including codes of deleted records.
6. Writes migration metadata while preserving attachment blobs, activity, active-case state, record IDs, and display codes.

Legacy datetime-local strings were labeled UTC, so the upgrade interprets them as UTC and retains original timeline input with `assumedTimezone: "UTC"`. V1 edges had no timestamps; migrated edge timestamps use the originating record's timestamps as a documented migration convention, not a reconstructed historical fact. Legacy attribute text that cannot be safely parsed is retained in `_legacyText`.

A malformed record or relationship aborts the entire upgrade. The error identifies the record/field or explicit relationship. IndexedDB rolls back the version change and all writes, leaving v1 intact for repair with a v1-compatible tool. Nothing is silently discarded or automatically reset. There is no migration repair UI in this release.

Historical duplicate case display codes caused by v1 are preserved. New case numbers allocate above the maximum workspace case counter/code. Internal UUIDs remain authoritative.

## Code allocation

Counters use `cases:workspace` and `tools:workspace` globally. Other kinds use `<kind>:<case UUID>`. Counter increment, record insertion, link mutations, and activity insertion share a write transaction. The active-case selector cannot affect case-code scope.

Deleting a record does not recycle its code. V2 backups retain counter high-water marks. Import takes the maximum of imported counters, stored counters, and imported record codes. Deleted-case counter remnants are excluded from portable backups because those case UUIDs no longer exist.

## Backup v2 and compatibility

Backups carry `format`, backup `version`, `schemaVersion`, `applicationVersion`, UTC `exportedAt`, scope, records, relationships, activity, attachment bytes, counters, and migration history. Attachment blobs are base64-encoded and retain name, MIME type, size, SHA-256, ownership, and collection metadata.

Export reads a consistent IndexedDB snapshot before encoding files. Individual-case exports include only the selected case and omit relationships to records outside that scope; full database exports preserve cross-case references and global tools.

Both v1 and v2 JSON imports are supported. V1 imports use the same conversion as the database migration and produce v2 data. V2 backups cannot be read by the v0.1 application. Unsupported versions are rejected.

Validation covers UUIDs, typed values, arrays, UTC timestamps, ranges, case ownership, endpoint kinds, duplicate edge tuples, provenance references, attachment metadata/encoding/size/hash, counters, and migration metadata. Collisions in **records, relationships, attachments, and activity** are checked before mutation. Imports use `bulkAdd` inside one transaction; they never overwrite investigation records silently. A failed import leaves the current workspace unchanged.

V1 exports cannot recover the counters of already-deleted records because that format never stored them. Their counters are reconstructed from the surviving codes. The automatic database upgrade does retain those legacy counters.

## Runtime and presentation boundaries

Graph creates one Cytoscape Core per mounted workspace. Element reconciliation updates by UUID without recreating the Core or retained nodes. Pan, zoom, positions, and selection survive record updates. Filters hide elements without deleting them. Layout runs on initial case load or an explicit layout choice, not on every data edit; subsequent layouts preserve viewport. New-node placement is provisional until the analyst chooses a layout.

Map creates one Leaflet instance with independent marker, route, and basemap layer groups. Marker and route objects reconcile by UUID; edits and filters do not refit the viewport. The initial location set for a case is fit once. Online tiles remain opt-in and receive no record payload.

`RecordDetailContent` and `RecordEditorContent` are exported separately from `ModalShell`. They can be mounted in a future inspector without rewriting persistence, attachment, or form logic. A mounted editor must be keyed by record ID when changing its target.

## Limitations

Single trusted browser profile; no encryption, cloud sync, collaboration, immutable audit trail, or legal chain-of-custody guarantee. Relationships have extensible labels, but advanced relationship metadata has no full editor yet. Position persistence, neighborhood focus, path finding, persistent inspector layout, and advanced time controls are deferred. The UI remains English-only; presentation adapters isolate control text from typed storage.
