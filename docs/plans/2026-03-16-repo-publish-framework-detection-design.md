# Design: Git Repo Publish & Extended Framework Detection

**Date:** 2026-03-16
**Status:** Approved

## Summary

Add two capabilities to myvibe-publish:
1. **Git repo publish** — clone a remote Git repository and publish it directly via `--repo` option
2. **Extended framework detection** — support Remix, SvelteKit, Angular, Solid.js, Gatsby, Hugo, Jekyll, MkDocs, Docusaurus with a generic fallback for unknown frameworks

## Approach

**SKILL.md-driven (Approach A):** Extend SKILL.md detection rules and workflow. Add one new script (`clone-repo.mjs`) for Git operations. Minimal changes to `publish.mjs`.

## Part 1: Extended Framework Detection

### Known Framework Rules (added to SKILL.md Step 1)

| Detection Condition | Framework | Build Command | Default Output Dir |
|---|---|---|---|
| `remix.config.*` or deps contain `@remix-run/*` | Remix | `npm run build` | `build/client` |
| `svelte.config.*` or deps contain `@sveltejs/kit` | SvelteKit | `npm run build` | `build` |
| `angular.json` or deps contain `@angular/core` | Angular | `npm run build` | `dist/<project-name>` |
| deps contain `solid-start` or `solid-js` + `vite` | Solid.js | `npm run build` | `dist` |
| `gatsby-config.*` or deps contain `gatsby` | Gatsby | `npm run build` | `public` |
| `hugo.toml/yaml/json` or has `content/` + `layouts/` | Hugo | `hugo` | `public` |
| `_config.yml` + Gemfile contains `jekyll` | Jekyll | `bundle exec jekyll build` | `_site` |
| `mkdocs.yml` | MkDocs | `mkdocs build` | `site` |
| `docusaurus.config.*` or deps contain `@docusaurus/core` | Docusaurus | `npm run build` | `build` |

### Generic Fallback

When no known framework matches:
1. If `package.json` exists with a `build` script → run build, then search `dist/`, `build/`, `out/`, `public/` for `index.html`
2. If no output directory found → prompt user to specify `--dir`

## Part 2: Git Repo Publish

### New CLI Options

| Option | Alias | Description |
|---|---|---|
| `--repo <url>` | `-r` | Git repository URL (HTTPS or SSH) |
| `--branch <ref>` | `-b` | Branch, tag, or commit hash (default: repo default) |
| `--path <subdir>` | `-p` | Subdirectory within the repo (for monorepos) |
| `--git-token <token>` | | Token for HTTPS clone of private repos |

### New Script: `scripts/utils/clone-repo.mjs`

**Input:** `--repo <url> [--branch <ref>] [--path <subdir>] [--git-token <token>]`
**Output:** JSON `{ success, clonePath, subdir, branch, commit }`

Core flow:
1. Validate URL format (HTTPS and SSH `git@...`)
2. Inject token if provided — transform `https://github.com/...` to `https://<token>@github.com/...`, memory-only, never persisted
3. Shallow clone to temp dir — `git clone --depth 1 [--branch <ref>] <url> /tmp/myvibe-repo-<hash>`
4. Validate subdirectory if `--path` specified
5. Return clone path for subsequent steps
6. Error handling — auth failure hints, network error hints

### SKILL.md Workflow Change

New **Step 0: Resolve Source** before existing Step 1:

```
if --repo provided:
  1. Call clone-repo.mjs to clone the repository
  2. Set --dir to clone path (or clone path + --path subdirectory)
  3. Proceed to Step 1 (project type detection)
else:
  Proceed to Step 1 (existing logic unchanged)
```

### publish.mjs Config Extension

New `source.type: "repo"` in config:

```json
{
  "source": {
    "type": "repo",
    "url": "https://github.com/user/project",
    "branch": "main",
    "path": "packages/app",
    "gitToken": "ghp_xxxxx"
  }
}
```

`parseConfig` recognizes `type: "repo"`, calls `clone-repo.mjs`, then converts to `dir` mode for existing publish flow. Temp directory auto-cleaned after publish.

### Security

- Git token used in memory only, never written to disk or logs
- URL token injection via `URL` object to prevent injection
- Temp directories use random suffix, cleaned after publish
- SSH mode relies on user's local SSH agent, no key handling

## Usage Examples

```bash
# Basic: clone and publish
/myvibe-publish --repo https://github.com/user/project

# Specific branch
/myvibe-publish --repo https://github.com/user/project --branch v2.0

# Monorepo subdirectory
/myvibe-publish --repo https://github.com/user/project --path packages/web

# Private repo with token
/myvibe-publish --repo https://github.com/user/private-project --git-token ghp_xxxxx

# Combined with existing options
/myvibe-publish --repo https://github.com/user/project --title "My App" --visibility private
```

## Files to Change

1. **`skills/myvibe-publish/SKILL.md`** — Add Step 0, extend Step 1 detection table, add new options docs
2. **`scripts/utils/clone-repo.mjs`** — New script for Git clone operations
3. **`scripts/publish.mjs`** — Add `--repo`, `--branch`, `--path`, `--git-token` args; extend `parseConfig` for `type: "repo"`
4. **`README.md` / `README.zh.md`** — Update feature list and usage examples
