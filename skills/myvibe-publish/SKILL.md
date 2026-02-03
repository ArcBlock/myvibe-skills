---
name: myvibe-publish
description: Publish static HTML, ZIP archive, or directory to MyVibe. Use this skill when user wants to publish/deploy web content to MyVibe.
---

# MyVibe Publish

Publish web content (HTML file, ZIP archive, or directory) to MyVibe.

## Usage

```bash
/myvibe:myvibe-publish --file ./dist.zip      # Publish ZIP
/myvibe:myvibe-publish --file ./index.html    # Publish HTML
/myvibe:myvibe-publish --dir ./dist           # Publish directory
/myvibe:myvibe-publish --url https://example.com/app  # Import from URL
/myvibe:myvibe-publish --dir ./dist --new     # Force new Vibe
/myvibe:myvibe-publish --dir ./dist --did z2qaXXX    # Update specific Vibe
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to compress and publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | MyVibe URL (default: https://www.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |
| `--did <did>` | | Vibe DID for version update (overrides auto-detection) |
| `--new` | | Force create new Vibe, ignore publish history |

## Workflow Overview

1. **Detect Project Type** → if no build needed, start screenshot in background
2. **Build** (if needed) → then start screenshot in background
3. **Metadata Analysis** → extract title, description, tags
4. **Confirm Publish** → show metadata, get user confirmation
5. **Execute Publish** → script auto-reads screenshot result
6. **Return Result** → show publish URL

**First tool call - execute in parallel:**
- `Read`: source file or main files in directory
- `Bash`: `git remote get-url origin 2>/dev/null || echo "Not a git repo"`
- `Bash`: `node {skill_path}/scripts/utils/fetch-tags.mjs --hub {hub}`

---

## Step 1: Detect Project Type

| Check | Project Type | Next Step |
|-------|-------------|-----------|
| `--file` with HTML/ZIP | **Single File** | → Start screenshot, then Step 3 |
| Has `dist/`, `build/`, or `out/` with index.html | **Pre-built** | → Step 2 (confirm rebuild) |
| Has `package.json` with build script, no output | **Buildable** | → Step 2 (build first) |
| Multiple `package.json` or workspace config | **Monorepo** | → Step 2 (select app) |
| Has `index.html` at root, no `package.json` | **Static** | → Start screenshot, then Step 3 |

**Start screenshot for non-build projects** (run_in_background: true):
```bash
node {skill_path}/scripts/utils/generate-screenshot.mjs --dir {publish_target} --hub {hub}
```

---

## Step 2: Build (if needed)

Detect package manager from lock files, build command from package.json scripts.

Use `AskUserQuestion` to confirm:
- **Pre-built**: "Rebuild or use existing output?"
- **Buildable**: "Build before publishing?"
- **Monorepo**: "Which app to publish?"

After build completes, start screenshot in background, then proceed to Step 3.

---

## Step 3: Metadata Analysis

### Extract title
Priority: `<title>` → `og:title` → package.json name → first `<h1>`

### Generate description (50-150 words, story-style)

Cover: **Why** (motivation) → **What** (functionality) → **Journey** (optional)

Sources: conversation history, README.md, source code, package.json, git log

Guidelines:
- Natural, conversational tone
- Focus on value and story, not technical specs
- Avoid generic "A web app built with React"

### Extract githubRepo
From git remote or package.json repository field. Convert SSH to HTTPS format.

### Match tags

Fetch tags: `node {skill_path}/scripts/utils/fetch-tags.mjs --hub {hub}`

| Tag Type | Match Method |
|----------|--------------|
| **techStackTags** | Match package.json dependencies against tag slug |
| **platformTags** | From conversation context (Claude Code, Cursor, etc.) |
| **modelTags** | From conversation context (Claude 3.5 Sonnet, GPT-4, etc.) |
| **categoryTags** | Infer from project (game libs → game, charts → viz) |

---

## Step 4: Confirm Publish

Display metadata and use `AskUserQuestion`:

```
Publishing to MyVibe:
──────────────────────
Title: [value]

Description:
[50-150 word story]

GitHub: [URL or "Not detected"]
Cover Image: [Will be included if ready]

Tags: Tech Stack: [...] | Platform: [...] | Category: [...] | Model: [...]
```

Options: "Publish" / "Edit details"

---

## Step 5: Execute Publish

**Check dependencies**: If `scripts/node_modules` missing, run `npm install` first.
**No need to check screenshot background task result** - the publish script automatically waits for and reads the screenshot result. Execute publish directly:

Pass config via stdin:

```bash
node {skill_path}/scripts/publish.mjs --config-stdin <<'EOF'
{
  "source": { "type": "dir", "path": "./dist", "did": "z2qaXXXX" },
  "hub": "https://www.myvibe.so",
  "metadata": {
    "title": "My App",
    "description": "Story description here",
    "visibility": "public",
    "githubRepo": "https://github.com/user/repo",
    "platformTags": [1, 2],
    "techStackTags": [3, 4],
    "categoryTags": [5],
    "modelTags": [6]
  }
}
EOF
```

- `did` optional - for explicit version updates
- `coverImage` auto-read from `/tmp/myvibe-screenshot-{hash}.json`
- Screenshot result file cleaned up after publish

---

## Step 6: Return Result

```
Published successfully!
🔗 [URL]

[If upgrade prompt shown:]
📦 Previous version overwritten. Want to keep version history?
   Upgrade to Pro → {hub}/pricing
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Dependencies missing | Run `npm install` in scripts directory |
| 401/403 Auth error | Token auto-cleared, re-run to authorize |
| Build failed | Analyze error, offer fix, or publish source as-is |
| Screenshot failed | Skip coverImage, proceed without it |
| agent-browser missing | Run `npm install -g agent-browser && agent-browser install` |

## Notes

- Always analyze content for meaningful title/description - never use directory names
- Confirm with user before publishing
- Default hub: https://www.myvibe.so/
- Tags cached 7 days locally
- Publish history in `~/.myvibe/published.yaml` for auto version updates
- Use `--new` to force new Vibe instead of updating
