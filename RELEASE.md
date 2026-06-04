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
4. Add `MCP_REGISTRY_TOKEN` only if publishing to the official MCP Registry from
   CI.
5. Protect `main`: require CI, reviews, and no direct force-push.

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
