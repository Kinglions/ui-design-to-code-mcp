# Security Policy

## Supported Versions

Only the latest npm dist-tag and explicitly documented pinned versions receive
security fixes.

## Reporting a Vulnerability

Report security issues privately through GitHub Security Advisories for this
repository. Do not open a public issue for credential leaks, arbitrary command
execution, path traversal, unsafe deletion, or supply-chain compromise.

## MCP Safety Rules

- Do not add tools that execute arbitrary shell commands.
- Do not allow writes outside an explicit design run directory unless the user
  selected a client config install/update command.
- Cleanup must remain dry-run by default.
- Never delete user source images, Figma exports, or files outside the run
  manifest.
- Runtime review scripts must remain explicit mode actions; source ingestion
  must not launch simulators, emulators, browsers, Gradle, or Xcode.
- Do not add `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, or
  `postpack` npm lifecycle scripts.

## Publishing Safety

- Prefer npm Trusted Publishing with GitHub Actions OIDC over long-lived
  `NPM_TOKEN` secrets.
- Protect the `main` branch and require CI before release.
- Use a protected GitHub Environment named `npm-publish` for release approval.
- Publish beta builds with `--tag beta`; reserve `latest` for validated stable
  releases.
- Run `npm run release:check` and `npm pack --dry-run` before publishing.
