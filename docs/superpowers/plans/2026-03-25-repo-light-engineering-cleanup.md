# Repository Light Engineering Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up repository-level tooling and documentation so maintainers have a clear root-level workflow without changing `myvibe-publish` behavior.

**Architecture:** Keep the product implementation in `skills/myvibe-publish/scripts/` and treat the repository root as the maintenance shell. Root-level commands should delegate into the skill implementation where appropriate, and maintainer-facing docs should explain that boundary explicitly.

**Tech Stack:** Node.js, npm, ESLint, Vitest, Markdown documentation

---

### Task 1: Tighten Repository Hygiene

**Files:**
- Modify: `.gitignore`
- Test: repository status via `git status --short`

- [ ] **Step 1: Review current ignore coverage**

Run: `sed -n '1,220p' .gitignore`
Expected: existing ignores for `node_modules/`, `.worktrees/`, and local editor/system files are visible.

- [ ] **Step 2: Add missing repository-level ignores**

Update `.gitignore` to keep it focused on root/repository artifacts likely to appear during maintenance work. Add only low-risk entries such as root install/build caches or tool outputs that should never be committed.

- [ ] **Step 3: Verify no tracked source files were accidentally hidden**

Run: `git status --short`
Expected: only the intentional `.gitignore` modification appears.

- [ ] **Step 4: Commit hygiene changes**

```bash
git add .gitignore
git commit -m "chore: tighten repository ignore rules"
```

### Task 2: Define Root-Level Tooling Entry Points

**Files:**
- Modify: `package.json`
- Optionally modify: `package-lock.json`
- Test: root-level npm scripts

- [ ] **Step 1: Inspect root and skill-level package contracts**

Run: `sed -n '1,220p' package.json`
Expected: root package is currently minimal and lacks scripts.

Run: `sed -n '1,240p' skills/myvibe-publish/scripts/package.json`
Expected: skill-level package exposes `lint`, `test`, `format`, and publish scripts.

- [ ] **Step 2: Add explicit root package metadata and maintenance scripts**

Update `package.json` so it clearly acts as repository-maintenance tooling. Add:
- basic package metadata such as `name` and `private`;
- scripts like `lint`, `test`, and possibly `format` or `lint:fix`;
- commands that delegate to `npm --prefix skills/myvibe-publish/scripts run ...`.

Keep dependencies minimal and repository-scoped.

- [ ] **Step 3: Sync the lockfile if package metadata or scripts require it**

Run: `npm install --package-lock-only`
Expected: `package-lock.json` updates only if root package metadata/dependencies changed.

- [ ] **Step 4: Verify the new root entry points**

Run: `npm run lint`
Expected: ESLint completes successfully using the documented root entry point.

Run: `npm test`
Expected: the skill-level Vitest suite runs successfully through the root command.

- [ ] **Step 5: Commit tooling entry-point changes**

```bash
git add package.json package-lock.json
git commit -m "chore: add repository maintenance scripts"
```

### Task 3: Add Maintainer-Facing Repository Guidance

**Files:**
- Modify: `README.md`
- Optionally modify: `README.zh.md`

- [ ] **Step 1: Review the current README structure**

Run: `sed -n '1,260p' README.md`
Expected: README is product-focused and has little maintainer guidance.

- [ ] **Step 2: Add a short maintainer workflow section**

Update `README.md` with a concise section that explains:
- the implementation boundary (`skills/myvibe-publish/scripts/`);
- the purpose of the root `package.json`;
- the root verification commands;
- where design and implementation documents now live.

Preserve the product-facing sections and avoid a full rewrite.

- [ ] **Step 3: Mirror or intentionally defer the Chinese README**

Either:
- add the same maintainer-oriented section to `README.zh.md`, or
- leave it unchanged and document in the commit/notes that Chinese maintainer docs are intentionally deferred.

Choose the lower-risk option based on the amount of translation needed in this cleanup.

- [ ] **Step 4: Verify documentation references**

Run: `rg -n "skills/myvibe-publish/scripts|npm run lint|npm test|docs/superpowers" README.md README.zh.md`
Expected: references match real file paths and commands.

- [ ] **Step 5: Commit maintainer documentation updates**

```bash
git add README.md README.zh.md
git commit -m "docs: add maintainer workflow guidance"
```

### Task 4: Clarify Forward Docs Structure

**Files:**
- Create: `docs/README.md`
- Test: docs path references

- [ ] **Step 1: Create a lightweight docs index**

Add `docs/README.md` that explains the intended structure going forward:
- `docs/superpowers/specs/` for design specs;
- `docs/superpowers/plans/` for implementation plans;
- `docs/plans/` as legacy/historical planning material already in the repo.

Do not move historical files in this cleanup unless an obviously safe rename is necessary.

- [ ] **Step 2: Link the docs index from the root README**

Update `README.md` to point maintainers to `docs/README.md` for planning/design document conventions.

- [ ] **Step 3: Verify the docs layout is coherent**

Run: `find docs -maxdepth 3 -type f | sort`
Expected: the docs tree clearly shows `docs/README.md`, `docs/superpowers/specs/`, and `docs/superpowers/plans/` alongside legacy `docs/plans/`.

- [ ] **Step 4: Commit docs structure clarification**

```bash
git add docs/README.md README.md
git commit -m "docs: clarify repository docs structure"
```

### Task 5: Final Repository Verification

**Files:**
- Verify all changes from Tasks 1-4

- [ ] **Step 1: Run the documented repository checks**

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Confirm documentation paths and root state**

Run: `git status --short --branch`
Expected: clean worktree on the active branch after the final commit.

- [ ] **Step 3: Sanity-check the final file structure**

Run: `find . -maxdepth 3 \\( -path './.git' -o -path './node_modules' -o -path './.worktrees' \\) -prune -o -type f | sort`
Expected: root-level structure is readable, with implementation under `skills/myvibe-publish/` and repository docs/tooling at the root.

- [ ] **Step 4: Prepare for follow-up optimization work**

Document any residual issues discovered during cleanup but defer them unless they block repository maintenance. Do not expand scope into publish-logic refactors.
