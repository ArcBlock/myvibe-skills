# Metadata Analysis Reference

## Execution Checklist

**Execute in order. Each step MUST output results.**

- [ ] **Step 1: Detect project type** → Output type detection result
- [ ] **Step 2: Extract metadata** → Output metadata table
- [ ] **Step 3: Fetch and match tags** → Output tags table
- [ ] **Step 4: Generate screenshot** → Output coverImage URL
- [ ] **Step 5: Show confirmation** → Display all metadata for user confirmation

---

## Required Output Format

### Metadata Table (after Step 2)

| Field | Value | Source |
|-------|-------|--------|
| title | [value] | `<title>` / package.json / not set |
| description | [story text] | AI-generated |
| githubRepo | [value] | .git/config / package.json / not detected |

### Tags Table (after Step 3)

| Type | Match Result | Tag IDs |
|------|--------------|---------|
| techStackTags | [names] or none | [ids] |
| platformTags | [names] or none | [ids] |
| categoryTags | [names] or none | [ids] |
| modelTags | [names] or none | [ids] |

### Screenshot Status (after Step 4)

| Status | coverImage URL |
|--------|----------------|
| success / skipped / failed | [URL or "will be auto-generated"] |

---

## Step 1: Detect Project Type

Output format:
```
Project Type Detection:
- Type: [Single HTML / Static / Pre-built / Buildable / Monorepo / Unknown]
- Reason: [characteristics]
- Next action: [publish directly / need build / ...]
```

---

## Step 2: Extract Metadata

### title
Priority: `<title>` → `og:title` → package.json `name` → first `<h1>` → directory name

### description

Generate a story-style description (50-150 words) covering:

1. **Why** - Motivation, problem solved, or inspiration
2. **What** - Core functionality and value
3. **Journey** (optional) - Creation process or iterations

**Information sources** (by priority):

| Source | What to extract |
|--------|-----------------|
| Conversation history | Original request, creation process, iterations |
| README.md | Motivation, features |
| Source code | Main features, functionality |
| package.json | name, description, keywords |
| Git history | Development journey (`git log --oneline -20`) |
| HTML content | App purpose from UI text |

**Guidelines:**
- Natural, conversational tone
- Focus on value and story, not technical specs
- Avoid generic descriptions like "A web application built with React"

### githubRepo

```bash
# Get git remote (works from subdirectories)
git remote get-url origin
```

Convert SSH format `git@github.com:owner/repo.git` → `https://github.com/owner/repo`

Fallback: package.json `repository` or `homepage` field

---

## Step 3: Fetch and Match Tags

### Fetch tags

```bash
node scripts/utils/fetch-tags.mjs --hub {hub}
```

Returns cached tags (7-day expiry) with `id`, `name`, `slug`, `type` fields.

### Match rules

| Tag Type | Match Method |
|----------|--------------|
| **platformTags** | Analyze conversation history to identify the creation platform (Claude, Cursor, Lovable, v0, Bolt, etc.) |
| **modelTags** | Analyze conversation history to identify the AI model used for creation (Claude 3.5 Sonnet, GPT-4, etc.) |
| **techStackTags** | Match package.json dependencies against tag `slug` |
| **categoryTags** | Infer from project characteristics (game libs → game, chart libs → viz, plain HTML → html) |

**platformTags & modelTags**: Analyze conversation context to identify:
- Which AI coding platform created the content (Claude Code, Cursor, Lovable, etc.)
- Which AI model was used (Claude 3.5 Sonnet, GPT-4o, Gemini, etc.)

If no creation context is available, leave empty.

---

## Step 4: Generate Screenshot

**Single command - handles everything automatically:**

```bash
node skills/myvibe-publish/scripts/utils/generate-screenshot.mjs --dir {publish_target_dir} --hub {hub}
```

The script automatically:
1. Checks agent-browser installation
2. Finds an available port (auto-retry if default port is in use)
3. Starts local http-server
4. Takes screenshot with agent-browser
5. Uploads to MyVibe
6. Cleans up (stops server, closes browser)

**Returns JSON on success:**
```json
{
  "success": true,
  "url": "https://...",
  "screenshotPath": "/tmp/myvibe-screenshot.png"
}
```

**Returns JSON on error:**
```json
{
  "success": false,
  "error": "Error description",
  "suggestion": "How to fix it"
}
```

**If screenshot fails:** Use the `suggestion` field to attempt fix and retry, or skip coverImage and let server auto-generate.

---

## Step 5: Show Confirmation

Display all metadata and ask user to confirm:

```
Publishing to MyVibe:
──────────────────────
Title: [value]

Description:
[generated story, 50-150 words]

GitHub: [URL or "Not detected"]
Cover Image: [URL or "Will be auto-generated"]

Tags (auto-detected):
- Tech Stack: [names or "None"]
- Platform: [names or "None"]
- Category: [names or "None"]
- Model: [names or "None"]
```

Use `AskUserQuestion` to confirm or edit before publishing.
