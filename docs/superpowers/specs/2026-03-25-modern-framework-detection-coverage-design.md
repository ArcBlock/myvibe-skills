# Modern Framework Detection Coverage Design

## Context

`myvibe-publish` currently detects project type at a coarse level in [skills/myvibe-publish/SKILL.md](/Users/pangxubin/git/myvibe-skills/skills/myvibe-publish/SKILL.md): single file, pre-built, buildable, monorepo, or static. That is enough to decide whether to build, but it is not enough to classify modern frontend frameworks reliably.

The result is that Vite, Next.js, Astro, and Nuxt projects are often treated as a generic “buildable” bucket. That limits coverage in two ways:

- framework-specific defaults are not available when detection needs to reason about likely output directories or project shape;
- later metadata work cannot cleanly build on a stable framework classification layer.

The repository already explored broader framework detection in earlier design work under `docs/plans/2026-03-16-repo-publish-framework-detection-design.md`, but this optimization round is intentionally narrower. The goal here is not to support every framework or rewrite the publish flow. The goal is to improve detection coverage for the framework families that likely represent the largest share of real-world usage: Vite, Next.js, Astro, and Nuxt.

## Goal

Increase detection coverage for modern frontend frameworks by adding explicit, structured detection rules for:

- Vite
- Next.js
- Astro
- Nuxt

The improved detection must preserve the existing publish flow while making framework identification more accurate and more reusable for later metadata improvements.

## Non-Goals

This design does not attempt to:

- redesign the full publish workflow;
- build a general scoring engine for every framework;
- expand detection to the broader framework list from the March 16 design;
- overhaul tag matching or title/description generation directly;
- solve monorepo selection comprehensively beyond avoiding obvious regressions.

## Current Problem

### Detection Is Too Coarse

The current Step 1 table decides “can this be built?” but not “what is it?”. A Vite app and a Next.js app can both look like “package.json with build script, no output”.

### Coverage Depends on User-Like Heuristics

Because framework detection is not expressed as a structured rule set, the agent is forced to infer framework identity ad hoc from whatever files it happens to inspect. That makes behavior less repeatable.

### Later Metadata Work Has No Stable Upstream Signal

If framework identity is not surfaced as a first-class detection outcome, downstream logic cannot reliably tailor metadata extraction or output assumptions.

## Recommended Approach

Use an incremental rule-expansion design.

This keeps the current workflow shape but makes the “buildable” branch more explicit by introducing a framework-aware detection layer for the target framework set.

### Why This Approach

Compared with a scoring system, rule expansion is lower risk and easier to validate in this repository. Compared with a two-stage flow rewrite, it improves coverage now without changing the outer publish sequence.

This design intentionally borrows one structural idea from a staged detector: distinguish between coarse project class and framework identity, but do so with minimal churn.

## Detection Model

Detection should produce two related outcomes:

1. **Project class**
   - single-file
   - static
   - pre-built
   - buildable
   - monorepo

2. **Framework identity** when applicable
   - vite
   - nextjs
   - astro
   - nuxt
   - unknown-buildable

The current flow already needs project class. This design adds framework identity as a refinement for buildable and pre-built web projects.

## Detection Rules

### Evidence Priority

Framework detection should rely on concrete evidence, in this order:

1. framework-specific configuration files
2. framework-specific package dependencies
3. framework-typical output directory patterns

Configuration files should outweigh dependency matches because dependencies can be indirect or stale. Output directories should be supporting evidence rather than the sole deciding signal.

### Next.js

Strong evidence:

- `next.config.js`, `next.config.mjs`, or `next.config.ts`
- `package.json` dependency or devDependency on `next`

Supporting evidence:

- `.next/`
- `app/` or `pages/` in combination with `next`

Default build interpretation:

- buildable when `package.json` has a build script and output is not present;
- pre-built only when a publishable static export output is already present and contains `index.html`;
- `.next/` by itself is supporting evidence for Next.js identity, not proof of a publishable pre-built target.

### Astro

Strong evidence:

- `astro.config.mjs`, `astro.config.ts`, or `astro.config.js`
- `package.json` dependency or devDependency on `astro`

Supporting evidence:

- `src/pages/`
- `dist/` as produced output

Default build interpretation:

- buildable with likely output `dist/`.

### Nuxt

Strong evidence:

- `nuxt.config.ts`, `nuxt.config.js`, or `nuxt.config.mjs`
- `package.json` dependency or devDependency on `nuxt`

Supporting evidence:

- `.output/`
- `app.vue` in combination with `nuxt`

Default build interpretation:

- buildable, but only static/export-like Nuxt output that actually yields a publishable directory should be treated as a publish target;
- pre-built only when publishable static output can actually be found.

### Vite

Strong evidence:

- `vite.config.js`, `vite.config.mjs`, or `vite.config.ts`
- `package.json` dependency or devDependency on `vite`

Supporting evidence:

- `dist/`
- `index.html` at project root alongside Vite dependency/config

Default build interpretation:

- buildable with likely output `dist/`.

### Unknown Buildable

If no target framework matches but `package.json` still has a build script, classify as:

- project class: buildable
- framework identity: unknown-buildable

This preserves current behavior while still making framework recognition explicit when it succeeds.

## Monorepo Handling

This optimization targets coverage, not full monorepo redesign, so monorepo behavior should remain conservative.

For projects with workspace signals or multiple `package.json` files:

- continue classifying the project as monorepo at the outer level;
- after the user selects a candidate app using the existing monorepo flow, apply the same framework rules to that selected package;
- do not attempt to infer a monorepo-wide framework.

This keeps the current interaction model intact while improving detection inside candidate apps.

## Integration Points

### SKILL.md

The immediate source of truth is still [skills/myvibe-publish/SKILL.md](/Users/pangxubin/git/myvibe-skills/skills/myvibe-publish/SKILL.md), so Step 1 must be updated to explicitly mention framework-aware detection for Vite, Next.js, Astro, and Nuxt.

However, the design should avoid burying all detection details only in prose. The detection criteria should be mirrored in code or utility structure where feasible so the logic becomes testable and less agent-dependent.

### Script Layer

The implementation may introduce or extend a small helper under `skills/myvibe-publish/scripts/utils/` that can:

- inspect package metadata;
- inspect config-file presence;
- return a normalized detection result.

This helper is meant to support Step 1 in [skills/myvibe-publish/SKILL.md](/Users/pangxubin/git/myvibe-skills/skills/myvibe-publish/SKILL.md), not to redesign the publish flow. The high-level sequence remains SKILL.md-driven.

This means the optimization should not stop at README-like rule text. It should make the rules executable.

## Output Expectations

The detection result should be structured enough to support later downstream work. A useful shape would include:

- project class
- framework identity
- evidence summary
- likely output directories

The exact field names are an implementation concern, but the result should be explicit rather than implicit.

## Alternatives Considered

### Option A: Expand Only SKILL.md

Add more framework-specific language to Step 1 and keep code mostly unchanged.

This is the smallest change, but it keeps the logic too agent-dependent and too hard to test. It improves coverage only superficially.

### Option B: Incremental Rule Expansion with Executable Detection

Add explicit framework rules and surface them through a small detection utility while preserving the current publish flow.

This delivers the best balance of coverage, maintainability, and implementation scope.

### Option C: Full Scoring-Based Detector

Introduce a generic evidence-scoring engine for all frameworks.

This is attractive long term, but it is larger than needed for the current goal and would slow delivery.

## Recommendation

Choose Option B.

Implement explicit framework rules for Vite, Next.js, Astro, and Nuxt using configuration files, dependencies, and supporting output clues, then expose the result through a small helper that Step 1 can call without changing the outer publish flow.

## Testing Strategy

Verification should focus on coverage and regression safety.

At minimum, add detection tests for:

- Vite by config file
- Vite by dependency plus root `index.html`
- Next.js by config file
- Next.js by dependency
- Astro by config file
- Nuxt by config file
- unknown buildable fallback
- static project staying static
- pre-built project staying pre-built
- monorepo remaining monorepo at outer classification

Tests should verify both successful identification and non-regression of the current coarse classes.

## Success Criteria

This optimization is successful if:

- Vite, Next.js, Astro, and Nuxt are recognized explicitly instead of falling into a generic buildable bucket in the common cases;
- the outer publish workflow remains unchanged for users;
- detection rules become executable and testable through a small helper used by Step 1 rather than living only in prose;
- later metadata work can build on a stable framework identity field.
