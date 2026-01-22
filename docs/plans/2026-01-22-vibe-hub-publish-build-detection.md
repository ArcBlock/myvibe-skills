# Vibe Hub Publish - Build Detection Enhancement

## Overview

Enhance the `vibe-hub-publish` skill to intelligently detect whether a project needs building before publishing, analyze build configuration, and handle various project types appropriately.

## Design Decisions

### Project Type Classification

| Type | Detection Criteria | Action |
|------|-------------------|--------|
| **Static** | Has `index.html` at root, no `package.json` | Publish directly |
| **Pre-built** | Has `dist/`, `build/`, or `out/` with `index.html` | Publish the output folder |
| **Buildable** | Has `package.json` with `build` script, no output folder | Confirm with user, then build |
| **Monorepo** | Multiple `package.json` files, workspace config | Ask user which app to build |
| **Unknown** | Cannot determine project type | Publish as-is, let server handle |

### Detection Priority

1. Check for explicit user path (`--dir` or `--file`) → trust user, publish directly
2. Check for existing build output → use it
3. Check for `package.json` with build script → offer to build
4. Check for root `index.html` → static site
5. Otherwise → unknown, publish as-is

### Build Configuration Detection

**Package Manager** (from lock files):
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `bun.lockb` / `bun.lock` → bun
- `package-lock.json` → npm
- None → npm (default)

**Build Command** (from `package.json` scripts):
- Priority: `build:prod` > `build:production` > `build`
- Fallback: `npm run build`

**Output Directory** (from config files):

| Config File | Default Output |
|-------------|----------------|
| `vite.config.*` | `dist` |
| `next.config.*` | `.next` or `out` |
| `webpack.config.*` | `dist` |
| `astro.config.*` | `dist` |
| `nuxt.config.*` | `.output` |
| None recognized | Check `dist`, `build`, `out` in order |

### User Interaction Rules

**Always Confirm:**
- Before executing a build command
- When monorepo detected (which app to build)

**Warn Only (no confirmation needed):**
- Missing environment variables (`.env.example` exists but no `.env`)
- Large files detected (> 10MB)

**No Interaction Needed:**
- Static site → publish directly
- Pre-built output exists → publish directly
- User specified explicit path → publish directly
- Unknown project type → publish directly

### Build Confirmation Dialog

When a buildable project is detected:

```
Project Analysis:
- Type: Vite + React project
- Package Manager: pnpm
- Build Command: pnpm run build
- Output Directory: dist

Proceed with build before publishing?
  [Build & Publish] - Run build, then publish dist/
  [Publish Source] - Skip build, publish as-is (server will process)
```

### Error Handling

**Build Failure:**
- Analyze error output
- Offer to help fix common issues (missing dependencies, config errors)
- User can choose to fix and retry, or publish source as-is

**Ambiguous Build Output:**
- If config says `dist` but `build` folder also exists
- Rebuild to ensure correct output

**Uncertainty:**
- When analysis is uncertain, be conservative
- Publish as-is and let the server's build pipeline handle it

### Monorepo Handling

When multiple `package.json` files detected:

```
Monorepo detected. Which app would you like to publish?
  - apps/web (Vite + React)
  - apps/admin (Next.js)
  - Other (specify path)
```

## Out of Scope (for now)

- `.gitignore` file filtering (may introduce other issues)
- Auto-excluding files based on patterns
- Custom exclusion configuration

## Enhanced Workflow

```
1. Analyze Content
   ├── Extract metadata (title, description)
   ├── Detect project type
   └── Check for build requirements

2. Build Decision (if buildable)
   ├── Show analysis results + warnings
   ├── Confirm build with user
   ├── Execute build
   └── Handle build errors (offer to help fix)

3. Confirm Publish (existing)

4. Execute Publish (existing)

5. Return Result (existing)
```

## Implementation Notes

- Local analysis is preprocessing only; server has its own build pipeline
- Be conservative: if unsure, publish as-is
- Trust explicit user input (`--dir`, `--file`)
- Build detection should not block publishing
