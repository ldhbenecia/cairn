# Security Policy

## Supported Versions

Only the latest release receives security fixes.

| Version | Supported |
| --- | --- |
| latest release | ✅ |
| older releases | ❌ |

## Design: what never leaves your machine

cairn is local-first by design. The following are **never** sent to any external API (Notion, GitHub, Anthropic):

- Source code bodies, diffs, patches, hunks
- Absolute file paths
- Tokens, API keys, email addresses

Only a whitelist egresses: PR titles and first-line descriptions, changed file names (basename only), commit subjects and short SHAs, repo basenames, and Notion page titles/URLs/last-edited times. This is enforced with fail-closed payload assertions (`assertNoForbiddenPayload`) and unit tests — see the `packages/core/src/common/sanitize` module.

Tokens you connect during onboarding are stored in a `.env` under `~/.cairn/` with owner-only file permissions (0600), on your machine only — exclude `~/.cairn/` from cloud backups if that matters to you. cairn has no server that receives them; optional cross-device sync uploads aggregate daily counts only. OS keychain storage is under consideration as a future hardening.

## Scope

**In scope** (please report):

- Any way to make code bodies, diffs, absolute paths, tokens, or emails leave the machine — a bypass of the egress whitelist is treated as the highest severity for this project
- Token/secret handling issues (exposure in logs, IPC, exported files, telemetry)
- Flaws in the auto-update path (update spoofing, downgrade)
- Injection via collected data (e.g. a malicious PR title / commit subject influencing what cairn sends or executes)

**Out of scope:**

- Vulnerabilities in third-party services themselves (Notion, GitHub, Anthropic) — report those upstream
- Attacks that require an already-compromised local machine or physical access (cairn stores tokens locally by design)
- Vulnerabilities in dependencies without a demonstrated impact on cairn (still welcome as a regular issue)

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

- Use [GitHub private vulnerability reporting](https://github.com/ldhbenecia/cairn/security/advisories/new) (preferred), or
- Contact the maintainer via the email on the GitHub profile.

Please include:

- The cairn version (Preferences → About) and your OS
- Reproduction steps or a proof of concept
- What data is affected and the impact you see

## What to expect

1. **Acknowledgement** — within 72 hours of your report.
2. **Assessment** — we confirm the issue and its severity, and keep you posted.
3. **Fix** — patches ship in the next release; egress-related issues are prioritized above everything else.
4. **Disclosure** — coordinated with you. Once fixed, the vulnerability is disclosed in the release notes, with credit to the reporter unless you prefer otherwise.

This is a solo-maintained open-source project with no bug bounty program — but every report is read and taken seriously.
