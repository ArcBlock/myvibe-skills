# Modern Framework Detection Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve project-type detection coverage for Vite, Next.js, Astro, and Nuxt without redesigning the outer publish workflow.

**Architecture:** Add a small executable detection helper under `skills/myvibe-publish/scripts/utils/` that inspects package metadata, config-file presence, and static-output clues, then use that helper to support Step 1 guidance in `skills/myvibe-publish/SKILL.md`. Keep the outer publish flow SKILL-driven and preserve the current coarse project classes while refining framework identity for modern frontend apps.

**Tech Stack:** Node.js ESM, Vitest, Markdown documentation

---

### Task 1: Add Detection Result and Fixture Tests

**Files:**
- Create: `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs`
- Test: `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs`

- [ ] **Step 1: Write the failing detection tests**

Create `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs` with fixture-style tests that define small in-memory project descriptions and expected detection results.

Include tests for:
- Vite by config file plus root `index.html`
- Vite by dependency plus build script
- Next.js by `next.config.*`
- Next.js by dependency without treating `.next/` alone as publishable pre-built output
- Astro by `astro.config.*`
- Nuxt by `nuxt.config.*`
- unknown buildable fallback
- static project staying static
- pre-built project staying pre-built only when a static output directory contains `index.html`
- monorepo staying monorepo at the outer level

Use explicit expected output objects, for example:

```javascript
expect(result).toMatchObject({
  projectClass: 'buildable',
  framework: 'vite',
  likelyOutputs: ['dist'],
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts exec vitest run utils/__tests__/detect-framework.test.mjs
```

Expected: FAIL because the detection helper does not exist yet.

- [ ] **Step 3: Commit the failing-test scaffold only if the implementation strategy requires it**

If needed for your workflow, keep this change uncommitted and proceed directly to implementation. Do not create an unnecessary intermediate commit.

### Task 2: Implement the Detection Helper

**Files:**
- Create: `skills/myvibe-publish/scripts/utils/detect-framework.mjs`
- Modify: `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs`

- [ ] **Step 1: Implement small, focused helper functions**

Create `skills/myvibe-publish/scripts/utils/detect-framework.mjs` with a narrow API and clear responsibilities. Prefer functions like:

```javascript
export function normalizePackageJson(pkg)
export function detectFrameworkEvidence(project)
export function detectProjectType(project)
```

The main exported detector should accept a structured project description such as:

```javascript
{
  hasRootIndexHtml: true,
  files: ['vite.config.ts', 'src/main.ts'],
  directories: ['src', 'dist'],
  packageJson: {
    scripts: { build: 'vite build' },
    dependencies: { vite: '^6.0.0' },
    devDependencies: {},
  },
  hasWorkspaceConfig: false,
  packageJsonCount: 1,
}
```

and return a structured result such as:

```javascript
{
  projectClass: 'buildable',
  framework: 'vite',
  evidence: ['vite.config.ts', 'dependency:vite'],
  likelyOutputs: ['dist'],
}
```

Keep the helper independent of filesystem reads for now so it is easy to test.

- [ ] **Step 2: Encode the framework rules explicitly**

Implement explicit rules for:
- Vite
- Next.js
- Astro
- Nuxt
- unknown-buildable fallback

Constraints:
- `.next/` alone must never mean “publishable pre-built”
- Nuxt must only imply publishable pre-built when an actual static output directory with `index.html` is present
- monorepo outer classification stays `monorepo`
- post-selection framework refinement can be supported by the helper, but no new monorepo candidate-discovery logic should be added here

- [ ] **Step 3: Run the focused tests**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts exec vitest run utils/__tests__/detect-framework.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit the helper and tests**

```bash
git add skills/myvibe-publish/scripts/utils/detect-framework.mjs skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs
git commit -m "feat: add modern framework detection helper"
```

### Task 3: Add a Step 1 Detection Adapter Without Changing the Outer Flow

**Files:**
- Create or Modify: `skills/myvibe-publish/scripts/utils/project-inspection.mjs`
- Modify: `skills/myvibe-publish/scripts/utils/detect-framework.mjs`
- Modify: `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs`
- Test: `skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs`

- [ ] **Step 1: Create a concrete filesystem adapter for Step 1 inputs**

Create or extend a small helper dedicated to Step 1 support. Its job is to read a real project directory and translate it into the structured input expected by `detect-framework.mjs`.

It should collect only the fields needed by the detector:
- package.json contents
- presence of config files
- presence of root `index.html`
- presence of known output directories and whether they contain `index.html`
- workspace signals and package.json count

Do not wire this through upload/publish execution logic in `publish.mjs`.

- [ ] **Step 2: Add concrete adapter tests**

Extend `detect-framework.test.mjs` or add adjacent tests so the adapter verifies:
- a selected single-app Vite project is refined to `framework: 'vite'`
- a selected single-app Next.js project is refined to `framework: 'nextjs'`
- a monorepo outer project still reports `projectClass: 'monorepo'`
- a selected monorepo app can be re-evaluated through the same helper after selection
- non-target flows still classify correctly: static stays static, pre-built static stays pre-built, unknown buildable stays unknown-buildable

- [ ] **Step 3: Keep the outer flow unchanged**

The adapter and helper together must support Step 1 decisions without changing the outer workflow sequence in `skills/myvibe-publish/SKILL.md`.

If a framework is detected, it still maps into the current coarse classes:
- buildable
- pre-built
- static
- monorepo

Framework identity is only a refinement returned alongside the coarse class.

- [ ] **Step 4: Run the focused detection tests**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts exec vitest run utils/__tests__/detect-framework.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run the full existing test suite**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts test
```

Expected: PASS with all existing tests still green.

- [ ] **Step 6: Commit the Step 1 support layer**

```bash
git add skills/myvibe-publish/scripts/utils/project-inspection.mjs skills/myvibe-publish/scripts/utils/detect-framework.mjs skills/myvibe-publish/scripts/utils/__tests__/detect-framework.test.mjs
git commit -m "feat: add framework-aware step 1 detection support"
```

### Task 4: Update the Skill Documentation to Match the Executable Rules

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md`

- [ ] **Step 1: Update Step 1 to mention framework-aware detection**

Revise the Step 1 detection section in `skills/myvibe-publish/SKILL.md` so it reflects the new framework-aware coverage for Vite, Next.js, Astro, and Nuxt.

The updated language should:
- stay consistent with the executable helper;
- avoid overpromising publishability for `.next/` or generic Nuxt production output;
- preserve the current outer workflow shape.

- [ ] **Step 2: Keep the wording concise**

Document only what is useful for runtime guidance. Do not embed a giant rules engine in prose now that the helper exists.

- [ ] **Step 3: Verify the docs align with code**

Verify against the implemented helper behavior with an explicit checklist, not just keyword presence.

Run:

```bash
rg -n "Vite|Next.js|Astro|Nuxt|pre-built|buildable|monorepo" skills/myvibe-publish/SKILL.md
npm --prefix skills/myvibe-publish/scripts exec vitest run utils/__tests__/detect-framework.test.mjs
```

Expected:
- SKILL.md Step 1 mentions only the supported framework-aware boundaries
- detector tests still pass after documentation edits

Then manually compare the implemented helper rules to the documented Step 1 guidance and confirm all of the following are true before committing:
- Next.js docs do not imply `.next/` alone is publishable pre-built output
- Nuxt docs do not imply generic `.output/` is publishable without static-output confirmation
- framework-aware detection is described as a refinement of the coarse classes, not a flow redesign
- monorepo wording stays limited to post-selection app inspection rather than new candidate discovery

If any one of these checklist items fails, revise `skills/myvibe-publish/SKILL.md` before committing.

- [ ] **Step 4: Commit the SKILL documentation update**

```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "docs: clarify framework-aware project detection"
```

### Task 5: Final Verification for the Detection Optimization

**Files:**
- Verify all changes from Tasks 1-4

- [ ] **Step 1: Run the full script-level test suite**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts test
```

Expected: PASS.

- [ ] **Step 2: Re-run the focused framework detector tests**

Run:

```bash
npm --prefix skills/myvibe-publish/scripts exec vitest run utils/__tests__/detect-framework.test.mjs
```

Expected: PASS, including:
- modern framework coverage cases
- monorepo outer classification
- post-selection app refinement cases
- non-target coarse-class regressions

- [ ] **Step 3: Run repository-level checks**

Run:

```bash
npm run lint
npm test
npm run format
```

Expected: all PASS from the repository root.

- [ ] **Step 4: Confirm worktree state**

Run:

```bash
git status --short --branch
```

Expected: clean worktree after the final commit.

- [ ] **Step 5: Record any deferred follow-ups**

Note, but do not implement, any next-step improvements such as:
- extending the same helper to more frameworks;
- using framework identity to improve metadata extraction;
- refining monorepo candidate discovery.
