# Dependency Diagnostics

## Current Finding

The landing page build is blocked by the local dependency installation, not by a confirmed application code error.

Observed build failure:

```text
Cannot find module 'styled-jsx/package.json'
```

What was found locally:

- `styled-jsx` exists in the pnpm virtual store.
- `landing-page/node_modules/next` points to the Next.js package in `.pnpm`.
- The Next.js package folder does not currently have a linked `styled-jsx` dependency where Node expects it.
- `pnpm install` attempts to repair the install but cannot complete because registry access repeatedly fails or times out.

## Config Fix Applied

The root `package.json` previously stored pnpm overrides under `pnpm.overrides`. The installed pnpm version reports that this location is no longer read.

The overrides now live in `pnpm-workspace.yaml`, matching the lockfile settings:

```yaml
overrides:
  '@types/react': ^18.3.3
  '@types/react-dom': ^18.3.0
```

## Next Repair Step

Run dependency repair in a normal terminal with network access:

```bash
pnpm install --config.confirmModulesPurge=false --no-frozen-lockfile
pnpm --filter landing-page build
```

If network policy blocks registry access, repair must be done from a network that can reach `registry.npmjs.org`, or by restoring a known-good `node_modules` / pnpm store snapshot.
