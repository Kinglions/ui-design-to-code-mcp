# Release Process

## One-time Setup

1. Keep npm account 2FA enabled. Do not disable OTP to work around local
   publish prompts.
2. Create the `ui-design-to-code-mcp` package on npm. `npm trust` requires the
   package to already exist. If npm does not allow configuring a trusted
   publisher before package creation, publish only the first version
   interactively with a one-time OTP, then use GitHub Actions for all future
   releases.
3. Use Node 22.14+ and npm 11.10+ when configuring or publishing through
   Trusted Publishing.
4. Configure npm Trusted Publishing for:
   - repository: `Kinglions/ui-design-to-code-mcp`
   - workflow file: `release.yml`
   - environment: `npm-publish`
   - allowed action: `npm publish`

   CLI helper:

   ```bash
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing --dry-run
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing
   ```

5. In GitHub, create an Environment named `npm-publish` and require manual
   approval.
6. MCP Registry publishing uses GitHub Actions OIDC through
   `mcp-publisher login github-oidc`; no long-lived registry token is required.
7. Protect `main`: require CI, reviews, and no direct force-push.

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

## Registry-only Publish

If the npm package version is already published but the MCP Registry job is
blocked or skipped, use the `Publish MCP Registry` workflow. It validates the
package metadata, verifies that the current package version exists on npm, and
publishes `server.json` with GitHub Actions OIDC without running `npm publish`
again.

## npm Authentication

The default npm publishing path is GitHub Actions Trusted Publishing:

```text
permissions:
  id-token: write
environment: npm-publish
```

```bash
npm publish --access public --tag latest
```

Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to the publish job. The npm CLI
detects the GitHub Actions OIDC environment and uses a short-lived credential.
Trusted Publishing also generates provenance automatically, so the workflow
does not need `--provenance`.

After Trusted Publishing is verified, set npm package publishing access to
require 2FA and disallow traditional tokens. This keeps trusted publishers
working while preventing long-lived token releases.

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

The current `npm-publish` GitHub Environment is protected for the `main` branch.
If you want tag push to publish directly, update that environment protection rule
first to allow `v*` tags.

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

## Codex Install Policy

Codex marketplace discovery is backed by this repository's plugin marketplace
snapshot:

```text
.agents/plugins/marketplace.json
plugins/ui-design-to-code/.codex-plugin/plugin.json
plugins/ui-design-to-code/.mcp.json
```

Users can add the marketplace and install the plugin with:

```bash
codex plugin marketplace add Kinglions/ui-design-to-code-mcp --ref main
codex plugin list --marketplace ui-design-to-code
codex plugin add ui-design-to-code@ui-design-to-code
```

The plugin registers `ui_design_to_code` through
`npx -y ui-design-to-code-mcp@latest serve`.

Codex installs are optimized for fast MCP startup. The installer writes
`~/.codex/config.toml` to execute `~/.codex/bin/serve-ui-design-to-code-mcp`
instead of running `npx` on every MCP startup. The package is installed under
`~/.codex/mcp-packages/ui-design-to-code-mcp`.

On macOS, the installer also creates
`~/Library/LaunchAgents/com.wuyb.codex.update-mcp-packages.plist`, which runs
`~/.codex/bin/update-mcp-packages` daily at 04:15. For `@latest` installs, the
script checks npm for a newer latest version and installs only when the version
changes. The updated package is used automatically by the next Codex MCP
startup or reload.
