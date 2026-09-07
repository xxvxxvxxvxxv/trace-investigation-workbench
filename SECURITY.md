# Security policy

## Supported release

TRACE v0.2.0-alpha receives fixes on a best-effort basis. This is an early local-first application, not an independently audited evidence-management system.

## Reporting vulnerabilities

Do not publish an issue containing a working exploit against a deployed instance or private investigation data. If the GitHub repository offers private vulnerability reporting, use **Security → Report a vulnerability**. If that feature is not enabled, open a minimal issue requesting a private reporting channel without technical exploit details or sensitive data. No monitored security email is configured in this distribution.

Include affected version, browser, impact, and a minimal reproduction with fictional records. Do not attach real backups. Maintainers should acknowledge receipt, reproduce in an isolated environment, coordinate a fix, and agree on disclosure before publishing details.

## Threat model

The intended boundary is one trusted browser profile on a trusted device. Same-origin scripts, malicious browser extensions, local account compromise, or an attacker who can read the browser profile can access IndexedDB. TRACE does not provide encryption, app passwords, server-side access control, or a tamper-evident audit trail.

External links and optional map tiles leave the application's local boundary. JSON exports include attachment data in cleartext. Treat backups as sensitive documents. Preserve originals separately and maintain backups suitable for your own retention requirements.

## Defensive measures

- React text rendering; no investigator-supplied HTML execution.
- HTTP(S)-only URL validation on forms and imports.
- Raster-only inline attachment previews; other files download as originals.
- File size limits and SHA-256 integrity verification on backup import.
- Schema-v2 typed value, UTC timestamp, range, and relationship endpoint validation.
- Atomic import rejects ID collisions in records, relationships, files, and activity.
- Duplicate relation checks serialize within the database service; graph and forms use one table.
- V1 upgrades run transactionally and fail without discarding malformed legacy data.
- Mutation services recheck attachment ownership and existing record identity.
- Formula-leading CSV cell protection.
- No telemetry or automated investigation-data transmission.

These measures reduce specific risks; they do not establish legal admissibility or guarantee safety against malicious local software.

## Alpha migration and compatibility

Back up existing work before upgrading. The automatic upgrade retains legacy data or fails with a diagnostic; it does not reset the workspace. V2 backups require v0.2 or later. The v0.1 app cannot understand the v2 schema. There is no downgrade or migration repair UI.

The relationship tuple index is non-unique to allow controlled legacy deduplication during upgrade. Application writes must use the transactional mutation service. Same-origin code or browser developer tools can bypass client validation; these are inside the trusted-device boundary, not a security sandbox.

Automated integrity tests are not a security audit. CI configuration is included; a successful hosted GitHub Actions run is only established after running it in the destination repository. Browser and cross-browser smoke review is the first task of the next release.
