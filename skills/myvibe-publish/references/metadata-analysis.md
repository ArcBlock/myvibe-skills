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
| description | [value] | `<meta>` / package.json / not set |
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
Priority: `<meta description>` → `og:description` → package.json `description` → README first paragraph

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
| **platformTags** | Config files: `vercel.json` → vercel, `netlify.toml` → netlify, `wrangler.toml` → cloudflare |
| **techStackTags** | Match package.json dependencies against tag `slug` |
| **categoryTags** | Infer from project characteristics (game libs → game, chart libs → viz, plain HTML → html) |
| **modelTags** | Scan for patterns: `anthropic`/`claude`, `openai`/`gpt`, `gemini`, `llama`, `mistral` |

---

## Step 4: Generate Screenshot

**CRITICAL: Execute each step as a SEPARATE Bash call to avoid timing issues.**

### 4.1 Check agent-browser

```bash
which agent-browser || npm install -g agent-browser && agent-browser install
```

### 4.2 Start server (separate call)

```bash
npx -y http-server {dir} -p 3456 &
```

### 4.3 Wait for server (separate call)

```bash
sleep 3 && curl -s http://localhost:3456 | head -1
```

### 4.4 Take screenshot (separate call)

```bash
agent-browser open http://localhost:3456 && agent-browser screenshot /tmp/cover-screenshot.png && agent-browser close
```

### 4.5 Upload screenshot

```bash
node scripts/utils/upload-image.mjs --file /tmp/cover-screenshot.png --hub {hub}
```

### 4.6 Stop server (separate call)

```bash
pkill -f "http-server.*3456" 2>/dev/null || true
```

**Fallback:** If screenshot fails, skip coverImage. Server will auto-generate.

---

## Step 5: Show Confirmation

Display all metadata and ask user to confirm:

```
Publishing to MyVibe:
──────────────────────
Title: [value]
Description: [value]
GitHub: [URL or "Not detected"]
Cover Image: [URL or "Will be auto-generated"]

Tags (auto-detected):
- Tech Stack: [names or "None"]
- Platform: [names or "None"]
- Category: [names or "None"]
- Model: [names or "None"]
```

Use `AskUserQuestion` to confirm or edit before publishing.
