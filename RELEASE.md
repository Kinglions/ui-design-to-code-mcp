# Release Process

## One-time Setup

1. In npm, create the `ui-design-to-code-mcp` package by publishing the first
   version or configure Trusted Publishing for the package after creation.
2. Configure npm Trusted Publishing for:
   - repository: `Kinglions/ui-design-to-code-mcp`
   - workflow: `.github/workflows/release.yml`
   - environment: `npm-publish`
3. In GitHub, create an Environment named `npm-publish` and require manual
   approval.
4. MCP Registry publishing uses GitHub Actions OIDC through
   `mcp-publisher login github-oidc`; no long-lived registry token is required.
5. Protect `main`: require CI, reviews, and no direct force-push.

## MCP Registry Authentication

The Release workflow authenticates to the official MCP Registry with GitHub
Actions OIDC:

```text
permissions:
  id-token: write
```

```bash
mcp-publisher login github-oidc
mcp-publisher publish
```

This avoids storing a long-lived `MCP_REGISTRY_TOKEN` in GitHub Secrets.

Manual token publishing remains available only as a fallback for local
operations, not for the default GitHub Actions release path.

## Branch Flow

Develop on `develop`, then open a pull request into `main`:

```bash
git checkout develop
npm run release:check
git push origin develop
```

Merge `develop` into `main` only after CI and review pass. Release only from
`main`.

## Stable Release

```bash
npm run release:check
npm pack --dry-run
npm version patch
git push
git push --tags
```

Then run the GitHub Actions `Release` workflow with:

```text
npm_tag = latest
publish_mcp_registry = true
```

## Beta Release

```bash
npm version prerelease --preid beta
git push
git push --tags
```

Then run the `Release` workflow with:

```text
npm_tag = beta
publish_mcp_registry = false
```

## Rollback

npm versions are immutable. Do not attempt to overwrite a broken version.

For clients using dynamic channels:

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --package-spec ui-design-to-code-mcp@<previous-good-version>
```

For npm package visibility, deprecate the bad version:

```bash
npm deprecate ui-design-to-code-mcp@<bad-version> "Use <previous-good-version> or newer."
```

## Client Update Policy

- Development: use `--channel beta`.
- Personal dynamic install: use `@latest`.
- Enterprise production: use pinned `--package-spec ui-design-to-code-mcp@x.y.z`.
- Emergency rollback: update clients back to a known good pinned version.
