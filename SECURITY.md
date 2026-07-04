# Security Policy

## Supported Versions

Only the latest release receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest release | ✅ |
| older releases | ❌ |

## Design: what never leaves your machine

cairn is local-first by design. The following are **never** sent to any external API (Notion, GitHub, Anthropic):

- Source code bodies, diffs, patches, hunks
- Absolute file paths
- Tokens, API keys, email addresses

Only a whitelist egresses: PR titles, file names (basename only), commit subjects, and Notion page titles/URLs. This is enforced with fail-closed payload assertions (`assertNoForbiddenPayload`) and unit tests — see `docs` and the `packages/core/src/common/sanitize` module.

Tokens you connect during onboarding are stored in a plaintext `.env` under `~/.cairn/` on your machine only. cairn has no server that receives them; optional cross-device sync uploads aggregate daily counts only.

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

- Use [GitHub private vulnerability reporting](https://github.com/ldhbenecia/cairn/security/advisories/new) (preferred), or
- Contact the maintainer via the email on the GitHub profile.

You can expect an initial response within a few days. Please include reproduction steps and the affected version. Once fixed, the vulnerability will be disclosed in the release notes.
