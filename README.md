# TRACE

**Open-Source Investigation Workbench** · v0.2.1-beta · MIT

TRACE is a local-first workspace for organizing open-source investigations. Keep evidence, entities, sources, timelines, hypotheses, and unanswered questions connected in one browser-based analyst environment.

The application is a standalone software project. Its only seeded investigation is **Harbor Signal**, an explicitly fictional training scenario. Real investigations belong in a private local workspace, not in this repository.

## Screenshots

Real release screenshots will be captured later using the fictional demo only. Expected files:

- `screenshots/dashboard.png` — active investigation overview
- `screenshots/evidence.png` — evidence register and right inspector
- `screenshots/graph.png` — focused relationship analysis
- `screenshots/map.png` — offline coordinate workspace
- `screenshots/report.png` — analyst report

No fake or generated application screenshots are included.

## What's new in beta

- Original geometric TRACE eye and three-node mark, inline SVG branding and local favicon.
- Graphite/slate surfaces, warm amber accents, system typography and modular CSS tokens.
- Grouped, collapsible navigation with a local saved preference; global pages clearly separated from case analysis.
- Persistent desktop record inspector with linked-record back/forward history. Narrow screens use the same detail content in a modal drawer.
- Record-specific table columns, selected rows, useful empty states, global search with case ownership, and Cmd/Ctrl+K focus.
- Active-case overview with an enlarged graph, prioritized next actions, recent intelligence, chronological snapshot and case activity.
- Graph search, node/relationship filters, neighborhood focus, ID/title/hidden labels, accessible node/edge selectors, and a relationship editor for confidence, notes, evidence and provenance.
- Offline map chrome, real Locations/Routes layer controls, coordinate readout, marker selection and opt-in online tiles.
- Timeline rails and range styling preserve the v2 time qualifiers. Elapsed intervals are shown only when known exact/range endpoints support them.
- Structured print reports with an attachment and SHA-256 appendix; global Settings, About and tool-library cards.

Schema and backup format remain **version 2**. No backend, accounts, synchronization, analytics, remote fonts or real investigation data were added.

## Core features

- Create, edit, archive, and switch cases with scope, jurisdiction, objectives, references, and priorities.
- Record evidence provenance, reliability, confidence, observed/collected dates, tags, and linked records.
- Track entities, custom attributes, aliases, relationships, sources, and analyst notes.
- Explore entity, evidence, location, source, event, and hypothesis nodes in Cytoscape with five layouts, type filters, zoom, selection, and relationship editing.
- Reconstruct timelines with confidence and source links; export filtered evidence and timeline tables to CSV.
- Place Leaflet markers using a map click or coordinates, categorize them, and connect locations with analyst-defined route lines.
- Track leads, hypotheses with supporting and contradicting evidence, and information gaps with resolution notes.
- Search across all cases and records; maintain a global OSINT tool library with favorites and last-used timestamps.
- Attach files up to 10 MB each, preview common image formats, record SHA-256 hashes, and download originals.
- Export the whole database or an individual case as schema-versioned JSON, including attachment bytes.
- Validate and import non-overlapping backups atomically. Existing records are never silently overwritten.
- Generate printable case reports with browser print-to-PDF support.

## Quick start

Prerequisites: Node.js 22.13+ (22 LTS recommended) and npm; a modern browser with IndexedDB and Web Crypto support.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The demo is created on the first launch only.

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

The production build is written to `dist/`. Serve it with a static HTTP server; do not open `index.html` directly with `file://`. Hash-based React Router navigation works on static hosts without a route rewrite. Localhost is suitable for development; use HTTPS when hosting so attachment hashing works.

For a repeatable dependency install from this distribution, use `npm ci`.

## First investigation

1. Explore Harbor Signal. All names and evidence are fictional; map coordinates are illustrative.
2. Create a new case using **New case** or **Cases**.
3. Add sources, entities, and evidence. Use linked-record checkboxes to associate them.
4. Record timeline events and locations. Use **Graph** to inspect and create relationships.
5. Add competing hypotheses, evidence for and against them, leads, and information gaps.
6. Export a backup in **Settings**. Keep originals outside browser storage.
7. Open **Reports** and print the selected case, or save it as a PDF using the browser.

To archive a case, edit its status to `archived`. Archived cases remain selectable and editable. Case-scoped records remain available when an archived case is selected.

## Architecture

TRACE is a client-only React application. Dexie wraps IndexedDB; reactive queries update views after local mutations. No server API, cloud database, login, or synchronization service is required.

Domain records have a typed, extensible envelope. Tags and aliases are arrays, coordinates are numbers, favorites are booleans, attributes are structured values, and investigation time includes UTC instants and precision metadata. The field registry remains a presentation definition; adapters convert form controls to domain values.

**Schema v2 has one authoritative relationship table.** Graph edges and form selections use the same indexed relationships and transactional mutation service. Record values never store comma-separated links. Incoming/outgoing/type queries, provenance, hypothesis evidence, and geographic associations share that model.

Dexie upgrades v1 workspaces automatically in a transaction. The upgrade preserves fictional demo records, attachments, history, identifiers, and links. Malformed legacy relations abort the upgrade and leave v1 unchanged with a diagnostic. V1 JSON backups can also be migrated during import. See [the v2 model and compatibility contract](docs/data-model.md).

Graph and Map retain their runtime instances across updates. Reconciliation updates elements and layers while preserving the analyst's viewport. `RecordInspector` reuses `RecordDetailContent` in a persistent desktop aside or narrow modal drawer. `inspectorHistory` manages bounded navigation history. Record editors and the relationship editor use the shared modal shell. Resizing the workspace preserves the graph center and zoom; record updates do not recreate the graph or map.

## Technology stack

| Component         | Technology                            |
| ----------------- | ------------------------------------- |
| Interface         | React, TypeScript strict mode         |
| Build             | Vite                                  |
| Navigation        | React Router, hash routing            |
| Local persistence | Dexie.js, IndexedDB                   |
| Reactive reads    | dexie-react-hooks                     |
| Graph             | Cytoscape.js                          |
| Map               | Leaflet; optional OpenStreetMap tiles |
| Icons             | Lucide React                          |
| Styles            | Custom responsive CSS                 |
| Tests             | Vitest, fake-indexeddb, Playwright    |

## Project structure

```text
src/
  components/   TRACE brand, inspector, timeline, empty state, detail/editor content
  pages/        Dashboard, lists, reports, settings, ethics
  features/     Graph/map components, incremental runtime and layer helpers
  db/           Versioned schema, v1→v2 migration, mutations, integrity tests
  models/       Typed records, relationship semantics, time, validation, field registry
  data/         Fictional demo and reference tool catalog
  utils/        Versioned backup validation, atomic import/export, CSV
  presentation/ Typed form adapters, per-kind columns, time labels and relationship projections
  styles/       Tokens, base, shell, components, records, dashboard, graph, map, timeline, report
  App.tsx       Workspace navigation and active-case composition
  main.tsx      Bootstrap and error boundary
  hooks/        Inspector history reducer and workspace context classification
  types/        Reserved for integration-specific declarations
docs/           Data model and release validation notes
screenshots/    Expected demo-only release screenshot filenames
e2e/            Portable Playwright browser smoke test
```

## Data model summary

| Store           | Purpose                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `records`       | Cases, evidence, entities, timeline events, locations, leads, hypotheses, gaps, sources, tools, notes |
| `relationships` | Authoritative typed edges, timestamps, optional confidence, notes and provenance                      |
| `attachments`   | Blob, filename, MIME type, size, SHA-256, record and case IDs                                         |
| `activity`      | Local case activity descriptions and timestamps; not a tamper-proof audit log                         |
| `counters`      | Workspace case/tool counters and case-scoped record counters                                          |
| `meta`          | Initialization, active-case state, migration metadata                                                 |

UUIDs identify records internally. Evidence IDs (`E001`), hypothesis IDs (`H001`), gap IDs (`IG001`), lead IDs (`L001`), and other display codes are allocated per case. Tools are global. Case numbers are analyst-editable display references, not database keys.

See [the data model](docs/data-model.md) for backup behavior and limitations.

## Local-first privacy model

The source repository contains application code and fictional sample data only. Actual work remains in IndexedDB in the current browser profile and origin. Opening TRACE at a different address or in another browser creates a separate workspace.

There are no analytics scripts, automatic evidence uploads, remote AI calls, or automatic Git commits. The hosted app shell can be private while case data remains local to each browser.

Optional OpenStreetMap tiles expose your IP and viewed map area to the tile provider. They are disabled by default. External tool and source links open independently and may be subject to provider logging and terms. The seed catalog is a reference directory; pricing, account needs, availability, and coverage should be verified at each provider.

## Security and privacy considerations

- Browser storage is **not an evidence archive**. Clearing site data, private browsing, eviction, profile loss, or device loss can remove your work.
- Export regularly. JSON backups contain cleartext investigation data and attachment bytes; store and share them deliberately.
- TRACE does not encrypt records or provide app-level authentication. Protect the device and browser profile.
- A SHA-256 hash detects changes relative to that recorded hash; it does not prove authenticity or establish legal chain of custody.
- Record deletion removes incoming typed links, manual edges, and attached files. Case deletion removes its records and activity. Export first.
- Backups are limited to 100 MB on import; attachments are limited to 10 MB each. Large investigations may need case-by-case exports or a later streaming format.
- URL fields accept HTTP(S) only. React escapes text; image previews are restricted to common raster formats. CSV exports prefix formula-leading cells.
- Import rejects unsupported versions, malformed references, unsafe URLs, inconsistent attachment bytes/hashes, and overlapping record IDs.
- This beta release is not independently security-audited. See [SECURITY.md](SECURITY.md).

## Ethical use

TRACE supports lawful public-source research and documentation. Users must comply with applicable law, platform terms, privacy requirements, and investigative ethics. Do not use it for unauthorized access, credential theft, stalking, harassment, doxxing, impersonation, or interference with police investigations. Record uncertainties and contradictions; minimize personal data and avoid unsupported allegations.

## Beta validation

All 32 alpha checks are retained, with nine additional checks for inspector navigation, context classification, time presentation, cryptographic UUID fallback and graph filtering: **41 tests**. Formatting, strict TypeScript, zero-warning lint and production build pass. CI retains the same quality gates.

All 15 requested desktop pages were visually inspected through the managed Chromium preview. The browser workflow created a fictional case, captured and edited evidence, inspected linked records, reloaded to confirm persistence, opened Graph and Map, and exported a backup whose JSON contained the persisted edit. Search ownership, Ctrl+K, filters, sidebar persistence, graph focus/relationship editing and map marker/layer interactions were checked. Only synthetic QA data was used; it is absent from this source distribution.

The portable Playwright smoke test is included and its discovery was checked. To run it locally:

```bash
npx playwright install chromium
npm run test:e2e
```

This environment requires browser control through its managed browser client, so the standalone Playwright runner was not executed here. Browser download-event waiting timed out in that client, but the exported file was present and its contents were verified separately. Narrow viewport coverage, multi-browser behavior, print pagination and secure-origin attachment previews still need a release check. See [validation details](docs/validation.md).

## Roadmap

- Run the portable browser suite in CI; expand narrow-screen, cross-browser and print QA.

- Offline-installable app shell / PWA.
- Encrypted backup format and streaming large-attachment exports.
- Additional per-kind value constraints and future schema migrations.
- Graph pathfinding, saved views, pinned nodes, evidence paths and relationship history.
- Richer time qualifier editing; current forms preserve imported qualifier metadata.
- Contextual tool launcher and additional geospatial layers when their data models exist.
- Multi-case source deduplication and conflict-resolution imports.
- More comprehensive accessibility, cross-browser, and large-case performance review.
- Optional collaboration, cloud sync, authentication, and AI integrations only after the single-user workflow matures.

No visible control depends on these planned features. This beta provides browser-based printing rather than a separate PDF renderer.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Use fictional fixtures only. Never attach live case exports to issues or pull requests.

## License

[MIT](LICENSE). Third-party libraries and external map data retain their respective licenses and terms.
