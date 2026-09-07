# Contributing to TRACE

Keep changes focused on a clear analyst workflow. Open an issue describing the problem, current behavior, expected behavior, and a minimal fictional reproduction before proposing a major feature.

## Development

1. Fork and clone the repository.
2. Install Node.js 22.13+, then run `npm ci`.
3. Run `npm run dev`.
4. Make a focused change using strict TypeScript and existing components.
5. Run `npm run format`, `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
6. For UI changes, check keyboard operation, empty states, narrow layouts, and 200% text enlargement. Include genuine screenshots using fictional demo data.
7. Open a pull request explaining the problem, changed behavior, validation, and limitations.

## Design constraints

- Local-first, single-user operation must remain functional without a cloud service.
- New network requests require an explicit product reason and a clear disclosure in the relevant user flow.
- Keep records case-scoped and database operations transactional where consistency matters.
- Preserve UUIDs and back up migration fixtures. Do not silently reinterpret older backups.
- Use the shared record editor and field registry for consistent validation and linking.
- Do not add dependencies without explaining the capability they provide.
- Never commit investigation exports, credentials, personal information, original evidence, or real-case screenshots.

Contributions are licensed under the repository's MIT license. Follow the Code of Conduct. Report security issues through the private process in SECURITY.md.
