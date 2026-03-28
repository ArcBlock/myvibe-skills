# Repository Light Engineering Cleanup Design

## Context

This repository's product surface is narrow: the main deliverable is the `myvibe-publish` skill and its supporting scripts under `skills/myvibe-publish/scripts/`. The repository root currently mixes product files with repository-maintenance concerns such as root-level Node dependencies, documentation drafts, and local development artifacts.

The goal of this cleanup is not to redesign the publish pipeline or move the implementation into a different architecture. The goal is to make the repository easier to maintain and safer to optimize later by establishing clear ownership boundaries, consistent entry points, and cleaner repository hygiene.

## Goal

Perform a light engineering cleanup that:

- keeps behavior unchanged for end users;
- keeps the core implementation centered in `skills/myvibe-publish/scripts/`;
- improves repository hygiene and developer ergonomics at the root;
- creates a clearer base for later optimization work.

## Non-Goals

This cleanup will not:

- change publish logic or UX behavior;
- split the skill into multiple packages;
- do broad refactors inside the publish implementation without a direct maintenance payoff;
- redesign the documentation system beyond the minimum structure needed for clarity.

## Current Problems

### Root Responsibility Is Blurry

The repository root now contains package-management files, docs, and local tooling concerns, but it does not yet clearly communicate whether it is the source of product logic or only the maintenance shell around the skill implementation.

### Maintenance Entry Points Are Inconsistent

The implementation already has its own scripts and dependencies under `skills/myvibe-publish/scripts/`, while the root also now has a `package.json`. Without explicit boundaries, later changes can easily duplicate tooling, drift command usage, or encourage editing in the wrong place.

### Repository Hygiene Is Only Partially Enforced

Some local artifacts are ignored already, but repository-level hygiene is still implicit. That increases the chance of accidental churn from install outputs, worktrees, caches, or similar non-source files.

### Docs Do Not Yet Guide Maintainers

The README explains the product well, but it does not yet give maintainers a short path for understanding where to work, how to verify changes, and what belongs at the root versus inside the skill implementation.

## Recommended Approach

Use a conservative cleanup that preserves the existing layout while formalizing repository boundaries.

### Root as Repository Shell

The root should be treated as the repository-maintenance layer. It owns:

- repository-wide ignore rules;
- repository-wide developer tooling entry points;
- top-level contributor guidance;
- high-level planning and design documents.

It should not become the place where publish behavior is implemented.

### Skill Directory as Product Boundary

`skills/myvibe-publish/` remains the product boundary. Its `scripts/` directory continues to own the publish implementation, supporting utilities, and implementation-focused tests.

### Single Developer Entry Surface

The root should provide the canonical commands a maintainer runs first, such as linting and tests. These commands can delegate into the skill implementation where appropriate, but the entry point should be obvious and documented once.

### Hygiene Before Refactor

Before any later optimization, the repository should explicitly ignore local artifacts and document the intended workflow. This reduces noise and lowers the chance of optimization work being mixed with accidental cleanup.

## Design Details

### 1. Repository Hygiene

Audit and strengthen `.gitignore` so the repository clearly excludes local and generated artifacts that do not belong in version control.

This includes preserving existing ignores and filling obvious repository-level gaps where needed. The changes should stay focused on common development artifacts rather than tool-specific speculation.

### 2. Root Tooling Contract

Make the root `package.json` intentionally repository-scoped rather than ambiguous.

It should answer these questions clearly:

- what root-level dependencies exist and why;
- what a maintainer runs to lint or test this repository;
- how those commands relate to the implementation under `skills/myvibe-publish/scripts/`.

If the root package is only a thin wrapper around repository maintenance commands, that should be reflected directly in script names and README guidance.

### 3. Documentation Cleanup

Update the root README so maintainers can quickly understand:

- where the actual feature code lives;
- how to run repository-level verification;
- how root tooling differs from skill-local tooling;
- where planning and design docs live.

The product-facing portions of the README should remain intact. The cleanup should add a short maintainer-oriented section rather than rewriting the whole document.

### 4. Docs Structure Clarification

The repository already stores planning/design documents under `docs/plans/`, but naming currently mixes designs and plans in one place. This cleanup should make the structure easier to understand without rewriting historical docs unnecessarily.

The preferred direction is:

- preserve existing historical docs;
- make the intended distinction explicit going forward;
- avoid large-scale doc moves unless they are low risk and clearly improve maintainability.

That means documentation cleanup should focus more on guidance and forward structure than on churning old files.

## Alternatives Considered

### Option A: Hygiene Only

Only adjust ignore rules and remove obvious repository clutter.

This is low risk, but it leaves command entry points and maintainer guidance underspecified, which means the next optimization round will still begin with avoidable repository confusion.

### Option B: Light Engineering Cleanup

Clarify the root/tooling/docs contract while keeping the existing code layout.

This has the best cost-to-benefit ratio because it improves repository usability now without forcing an early structural refactor.

### Option C: Structural Reorganization

Rework docs layout and implementation boundaries more aggressively now.

This would likely create more churn than value at the current stage because the repository is still small and the upcoming optimization work is not yet concretely defined.

## Recommendation

Choose Option B: light engineering cleanup.

It creates a stable maintenance surface for future optimization work while minimizing risk to existing behavior and keeping the implementation in its current, understandable location.

## Implementation Boundaries

The implementation phase for this cleanup should be limited to:

- repository hygiene files such as `.gitignore`;
- root-level developer tooling config such as `package.json`;
- root README and related maintainer-facing documentation;
- small docs-structure clarifications that do not cause broad historical churn.

The implementation phase should avoid changing publish logic unless a repository-level tooling fix makes a tiny implementation adjustment unavoidable.

## Testing Strategy

Because this is a maintenance cleanup, verification should focus on:

- confirming the repository status remains clean after the changes;
- confirming root-level scripts resolve and run as documented;
- confirming existing implementation tests still have a clear invocation path;
- confirming documentation references match actual files and commands.

## Success Criteria

This cleanup is successful if:

- a maintainer can identify the implementation boundary immediately;
- root-level commands provide an obvious verification entry point;
- repository-local artifacts are less likely to leak into git;
- documentation tells a future optimization pass where to start without rediscovering repository conventions.
