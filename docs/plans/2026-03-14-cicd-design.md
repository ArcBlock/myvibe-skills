# CI/CD Pipeline Design

Date: 2026-03-14
Status: Approved
Approach: Full custom GitHub Actions — no third-party release tools

## Problem

The project has no CI/CD. Code quality, test execution, security scanning, and version releases are all manual.

## Solution Overview

Two GitHub Actions workflows + ESLint/Prettier configuration.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR to main, push to main | Lint + format check + test + security scan |
| `release.yml` | Push to main (auto), workflow_dispatch (manual) | Version bump + tag + GitHub Release |

## CI Workflow (`ci.yml`)

### Job: lint-and-test

- Runner: `ubuntu-latest`, Node.js 20
- Steps:
  1. Checkout code
  2. `npm install --prefix skills/myvibe-publish/scripts`
  3. `npx eslint` — check `scripts/**/*.mjs`
  4. `npx prettier --check` — format check
  5. `npx vitest run` — run tests

### Job: security

- Steps:
  1. `npm audit --prefix skills/myvibe-publish/scripts` — dependency vulnerability check
  2. `trufflesecurity/trufflehog` action — secret leak scanning

## Release Workflow (`release.yml`)

### Trigger

- **Auto**: push to main — parses conventional commits since last tag
- **Manual**: `workflow_dispatch` with bump type input (patch/minor/major)

### Bump Logic (auto mode)

| Commit Pattern | Bump |
|---------------|------|
| `BREAKING CHANGE` or `!:` | major |
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| `chore:` / `docs:` / `test:` / other | skip release |

### Steps

1. Checkout with `fetch-depth: 0`
2. Determine bump type (manual input or commit parsing)
3. Read current version from latest git tag
4. Calculate new version
5. Update version in two files:
   - `.claude-plugin/marketplace.json` → `metadata.version`
   - `skills/myvibe-publish/scripts/package.json` → `version`
6. Generate changelog (group feat/fix commits)
7. Git commit + tag `v{version}` + push
8. `gh release create` with changelog as body

### Permissions

- `contents: write` — push tags and create releases
- Uses default `GITHUB_TOKEN`

## ESLint + Prettier Configuration

### New devDependencies (in `scripts/package.json`)

- `eslint`, `@eslint/js`, `globals` — linting
- `prettier`, `eslint-config-prettier` — formatting

### Config Files (project root)

| File | Purpose |
|------|---------|
| `eslint.config.mjs` | Flat config, recommended rules, node globals, target `scripts/**/*.mjs` |
| `.prettierrc` | `singleQuote: true, semi: false, printWidth: 120` |
| `.prettierignore` | Ignore `node_modules`, `package-lock.json` |

### New Scripts (in `scripts/package.json`)

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --check .",
"format:fix": "prettier --write ."
```

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | PR checks |
| `.github/workflows/release.yml` | Auto/manual release |
| `eslint.config.mjs` | ESLint config |
| `.prettierrc` | Prettier config |
| `.prettierignore` | Prettier ignore |

### Modified Files

| File | Change |
|------|--------|
| `skills/myvibe-publish/scripts/package.json` | Add eslint/prettier devDeps + scripts |

### First-Time Setup

1. Run `prettier --write` and `eslint --fix` on existing code
2. Commit: `chore: format existing code with prettier and eslint`
3. CI can then enforce checks on subsequent PRs

## Constraints

- No third-party release tools (no release-please, no semantic-release)
- No new production dependencies
- ESLint flat config format (no legacy `.eslintrc`)
- Prettier as the single source of formatting truth
