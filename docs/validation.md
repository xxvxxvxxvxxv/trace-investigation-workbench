# TRACE v0.2.1-beta validation

## Automated checks

The 32 alpha behavior checks remain, plus nine focused checks (41 total):

| Area                   | Coverage                                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing v2 foundation | Seed idempotence, real IndexedDB v1 upgrade and rollback, duplicate coalescing, authoritative relationship projections, cross-case rules, concurrent code allocation, timestamps, structured values, backup/import collisions, byte/hash integrity, deletion cleanup and CSV safety |
| Persistent graph       | Core/node identity, position, selection, pan and zoom survive updates; filtering/focus hides elements without destroying them                                                                                                                                                       |
| Inspector              | Back/forward, branch replacement, duplicate selection, close, bounded history                                                                                                                                                                                                       |
| Context                | Global Cases, Tools, Settings and About; case-scoped analysis and reporting                                                                                                                                                                                                         |
| Timeline               | Exact 49-hour gap, uncertain bounds, range endpoints and qualifier labels                                                                                                                                                                                                           |
| IDs                    | Cryptographic UUID v4 fallback when the secure-context convenience API is unavailable                                                                                                                                                                                               |

The legacy duplicate test now compares the full sorted ID sets: IndexedDB returns primary-key order, which need not equal fixture insertion order. No retained-ID assertion was removed. The backup version assertion reflects the beta application version; schema 2 is unchanged.

## Quality gates

```bash
npm ci
npm run format
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

All gates passed for this release. ESLint reported no project errors or warnings. The environment's npm proxy-configuration warning is external to the project. GitHub Actions retains the lockfile install, formatting, typecheck, lint, unit tests and build gates; no destination GitHub Actions execution is claimed.

## Browser review completed

Managed Chromium preview, desktop viewport approximately 1363 × 936 CSS pixels, September 7, 2026. Each requested page was opened and visually inspected: Overview, Cases, Evidence, Entities, Timeline, Graph, Map, Hypotheses, Information Gaps, Sources, Notes, OSINT Tools, Reports, Settings and About / Ethics. Leads was also reviewed.

The review led to concrete iterations: reduced overview header space; graph IDs by default with optional titles; better graph spacing; viewport-center preservation when the inspector changes canvas width; distinct empty-state creation labels; corrected timeline sort controls; source reliability filtering; and clear unassessed defaults for new confidence/reliability fields.

Completed interaction checks:

1. Created `Fictional beta smoke case` through the UI.
2. Captured `Fictional smoke observation` and opened its inspector.
3. Reloaded and confirmed the same evidence remained.
4. Edited the description and returned to the inspector.
5. Navigated linked records and back; verified global search identifies the owning case and opens the right record.
6. Confirmed Ctrl+K focuses search and sidebar collapse survives reload.
7. Opened Graph and Map after reload; selected a graph node, focused its neighborhood, fit the view, changed filters, and edited relationship notes.
8. Clicked a map marker to open the inspector and toggled the real route layer.
9. Filtered evidence and the global tool library; checked absence of case/demo framing on global pages.
10. Exported the full workspace and parsed the resulting JSON: schema 2, application 0.2.0-beta, 40 records and 33 relationships, including the saved synthetic evidence edit. The managed client's download-event waiter timed out, but the completed file was found and verified. The export is QA output, not source content.

The preview's HTTP origin initially lacked `crypto.randomUUID`. The fallback uses `crypto.getRandomValues` with RFC v4 version/variant bits; it never uses Math.random. SHA-256 still requires Web Crypto on HTTPS or localhost. Attachment operations display a clear error if those integrity checks are unavailable; they are never skipped.

## Portable Playwright suite

`e2e/workspace.spec.ts` covers case/evidence creation, inspector opening, reload persistence, graph node inspection, map online-tile default, global Settings framing and backup download. `playwright.config.ts` uses an isolated test context and a local Vite server at 1440 × 1000.

```bash
npx playwright install chromium
npm run test:e2e
```

`playwright test --list` successfully discovers the test. The standalone runner was not executed: this environment requires browser automation through its managed browser client. The equivalent interactive smoke flow was exercised as described above.

## Remaining limitations

- Dedicated narrow-screen/drawer, 1440/1680/1920, 200% text enlargement and multi-browser passes remain. Responsive styles are implemented and source-reviewed; the available browser API did not expose viewport resizing. Browser zoom shortcuts did not change its viewport.
- Report layout was inspected onscreen; actual printed/PDF pagination needs a release check. No fake screenshots are supplied.
- Secure-origin attachment upload/preview was not exercised in the HTTP preview. Existing byte/hash validation tests pass.
- Range/uncertain timeline rendering has unit coverage; the fictional seed contains exact times. Rich qualifier editing remains deferred.
- No independent accessibility/security audit or large-case performance certification is claimed.

## Schema review

No Dexie version, store definition, relationship semantics, typed values, counter scope or migration algorithm changed. Database edits are limited to cryptographic ID generation and actionable secure-origin errors for attachment integrity checks. Beta retains schema and backup version 2, transactional mutation services, v1 migration, referential checks and collision handling.
