# Metadata Analysis Reference

This document describes how to analyze and extract metadata for MyVibe publish.

---

## Execution Checklist

**CRITICAL: Execute the following steps in order. Each step MUST output results.**

- [ ] **Step 1: Detect project type** → Output type detection result
- [ ] **Step 2: Extract metadata** → Output metadata table (with source)
- [ ] **Step 3: Fetch and match tags** → Output tags table
- [ ] **Step 4: Generate screenshot** → Output coverImage URL
- [ ] **Step 5: Show confirmation** → Display all metadata for user confirmation

**Note:** Each step MUST output a result table or status. Do not skip any step.

---

## Required Output Format

### Metadata Output (MUST output after Step 2)

| Field | Value | Source |
|-------|-------|--------|
| title | [extracted value] | `<title>` / package.json / not set |
| description | [extracted value] | `<meta>` / package.json / not set |
| githubRepo | [extracted value] | .git/config / package.json / not detected |

### Tags Output (MUST output after Step 3)

| Type | Match Result | Tag IDs |
|------|--------------|---------|
| techStackTags | [tag names] or none | [ids] |
| platformTags | [tag names] or none | [ids] |
| categoryTags | [tag names] or none | [ids] |
| modelTags | [tag names] or none | [ids] |

### Screenshot Output (MUST output after Step 4)

| Status | coverImage URL |
|--------|----------------|
| success / skipped / failed | [URL or "will be auto-generated"] |

---

## Field Overview

| Field | Source | Method |
|-------|--------|--------|
| `title` | HTML/package.json | Rule-based extraction |
| `description` | HTML/package.json | Rule-based extraction |
| `coverImage` | Browser screenshot | agent-browser + upload |
| `githubRepo` | .git/config, package.json | Rule-based extraction |
| `platformTags` | URL analysis | Domain matching |
| `techStackTags` | package.json | Dependency matching |
| `categoryTags` | Code analysis | AI inference |
| `modelTags` | Code comments | Pattern matching |

---

## 1. Basic Metadata

### 1.1 title

**Priority order:**
1. `<title>` tag in index.html
2. `<meta property="og:title">` in index.html
3. `name` field in package.json
4. First `<h1>` in index.html

**Fallback:** Use directory name (cleaned)

### 1.2 description

**Priority order:**
1. `<meta name="description">` in index.html
2. `<meta property="og:description">` in index.html
3. `description` field in package.json
4. First paragraph in README.md

**Fallback:** Leave empty (user should provide)

### 1.3 githubRepo

**IMPORTANT: Supports subdirectory execution**

When executing from a subdirectory, the .git directory may be in a parent directory. You must correctly find the git root.

**Detection steps:**

1. **Find git root directory** (supports subdirectory execution):
   ```bash
   git rev-parse --show-toplevel
   ```

2. **Read remote URL**:
   ```bash
   # Method 1: Use git command
   git remote get-url origin

   # Method 2: Read config file
   cat "$(git rev-parse --show-toplevel)/.git/config" | grep -A2 'remote "origin"'
   ```

3. **Convert URL format**:
   - SSH format: `git@github.com:owner/repo.git` → `https://github.com/owner/repo`
   - HTTPS format: Remove `.git` suffix
   - Other formats: Keep as-is (may be other git services)

**Fallback sources (if .git doesn't exist):**
1. `package.json` - `repository` field (string or object with `url`)
2. `package.json` - `homepage` field (if github.com)

**Format:** Full GitHub URL (https://github.com/owner/repo)

---

## 2. Tags Data

Use the `fetch-tags.mjs` script to get cached tags data:

```bash
node scripts/utils/fetch-tags.mjs --hub {hub}
```

**Script features:**
- Caches tags locally at `~/.myvibe/cache/tags-{hash}.json`
- Cache expires after 7 days
- Use `--refresh` to force refresh
- Returns all tag types in one call

**Output format:**
```json
{
  "success": true,
  "fromCache": true,
  "hub": "https://staging.myvibe.so",
  "fetchedAt": "2026-01-23T10:00:00.000Z",
  "expiresAt": "2026-01-30T10:00:00.000Z",
  "tags": {
    "platform": [...],
    "tech-stack": [...],
    "model": [...],
    "category": [
      {
        "id": 2,
        "type": "category",
        "name": "Game",
        "slug": "game",
        "description": "",
        "icon": "lucide:gamepad-2",
        "isActive": true,
        "usageCount": 19
      }
    ]
  }
}
```

**Key fields for matching:**
- `id`: Numeric ID to use in tag arrays
- `name`: Display name
- `slug`: URL-friendly identifier for matching
- `type`: Tag type (platform, tech-stack, model, category)

---

## 3. platformTags

Match based on `tag.slug` and platform-specific config files.

**Detection method:**
1. Check for platform-specific config files in project
2. Match slug against known platform identifiers

**Common platforms and detection:**
| Slug | Config Files | URL Patterns |
|------|-------------|--------------|
| vercel | `vercel.json` | `.vercel.app` |
| netlify | `netlify.toml` | `.netlify.app` |
| github-pages | `.github/workflows/*pages*` | `.github.io` |
| cloudflare | `wrangler.toml` | `.pages.dev` |

**Matching logic:**
```
For each platform tag from API:
  if project has matching config file:
    add tag.id to platformTags
```

---

## 4. techStackTags

Match based on package.json dependencies against `tag.slug`.

**Detection method:**
1. Read `package.json` dependencies and devDependencies
2. Match dependency names against `tag.slug`

**Matching logic:**
```
For each tech-stack tag from API:
  For each dependency in package.json:
    if tag.slug matches dependency name (or common alias):
      add tag.id to techStackTags
```

**Common slug to npm package mappings:**
| Tag Slug | npm Package(s) |
|----------|----------------|
| react | react |
| vue | vue |
| svelte | svelte |
| angular | @angular/core |
| next | next |
| nuxt | nuxt |
| astro | astro |
| vite | vite |
| tailwind | tailwindcss |
| typescript | typescript |
| three | three |
| d3 | d3 |

---

## 5. categoryTags

AI inference based on project characteristics. Match against available category tags from API.

**Available categories (example from API):**
- Game (slug: game)
- 3D Model (slug: 3d)
- Tech Share (slug: tech)
- Creative Coding (slug: code)
- Data Visualization (slug: viz)
- Productivity (slug: prod)
- Landing Page (slug: landing-page)
- Blog (slug: blog)
- Tool (slug: tool)
- HTML (slug: html)

**Inference rules:**

| Category Slug | Detection Signals |
|---------------|-------------------|
| game | Has `phaser`, `pixi`, `three`, `babylon`, game-related terms |
| 3d | Heavy use of Three.js, WebGL, 3D model files |
| viz | Chart libraries (`chart.js`, `echarts`, `d3`), canvas/svg heavy |
| code | Creative/generative code patterns, p5.js, canvas animations |
| tech | Technical documentation, tutorials, code examples |
| prod | Task management, utilities, productivity tools |
| landing-page | Simple structure, marketing content, hero sections |
| blog | Article/post structures, markdown content |
| tool | Single-purpose utility, form-heavy interface |
| html | Plain HTML without framework |

**AI prompt for inference:**
```
Based on the project structure, dependencies, and code patterns,
select the most appropriate category from the available tags.
Consider: primary functionality, target audience, content type.
Return the tag ID that best matches.
```

---

## 6. modelTags

Detect AI model usage from code patterns.

**Detection patterns:**

| Model | Code Patterns |
|-------|---------------|
| Claude | `anthropic`, `claude`, `@anthropic-ai/sdk` |
| GPT | `openai`, `gpt-4`, `gpt-3.5`, `chatgpt` |
| Gemini | `@google/generative-ai`, `gemini` |
| Llama | `llama`, `meta-llama` |
| Mistral | `mistral` |

**Scan locations:**
1. Package.json dependencies
2. Import statements in JS/TS files
3. Comments mentioning AI models
4. Environment variable names (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
5. README.md content

**Matching logic:**
```
For each model tag:
  if any pattern matches in scanned files:
    add tag.id to modelTags
```

---

## 7. coverImage

Screenshot the rendered page and upload using `agent-browser` (headless browser CLI).

### 7.1 Check and Install agent-browser

**Check if installed:**
```bash
which agent-browser
```

**If not installed, install it:**
```bash
npm install -g agent-browser
agent-browser install  # Download Chromium
```

**For Linux with missing dependencies:**
```bash
agent-browser install --with-deps
```

### 7.2 Screenshot Process

**Using agent-browser (headless, no visible browser window):**

**IMPORTANT: Execute commands separately to avoid timing issues.**

All target users have Node.js installed (required for Claude Code and web development), so always use Node-based static servers.

**Step 1: Start local server (separate Bash call)**

```bash
npx -y http-server {dir} -p 3456 &
```

Or use `serve`:
```bash
npx -y serve {dir} -p 3456 &
```

**Step 2: Wait for server to be ready (separate Bash call)**

```bash
# Wait and verify server is running
sleep 3 && curl -s http://localhost:3456 | head -1
```

If curl fails, wait longer or check if port is in use.

**Step 3: Take screenshot (separate Bash call)**

```bash
agent-browser open http://localhost:3456 && agent-browser screenshot /tmp/cover-screenshot.png && agent-browser close
```

**Step 4: Stop server (separate Bash call)**

```bash
pkill -f "http-server.*3456" 2>/dev/null || pkill -f "serve.*3456" 2>/dev/null || true
```

**For single HTML file:**

```bash
# Step 1: Start server in parent directory
npx -y http-server {file_parent_dir} -p 3456 &

# Step 2: Wait for server
sleep 3 && curl -s http://localhost:3456 | head -1

# Step 3: Take screenshot (specify filename in URL)
agent-browser open http://localhost:3456/{filename} && agent-browser screenshot /tmp/cover-screenshot.png && agent-browser close

# Step 4: Stop server
pkill -f "http-server.*3456" 2>/dev/null || true
```

**Screenshot settings:**
- Format: PNG
- Save to `/tmp/cover-screenshot.png` (absolute path recommended)
- Default viewport size (no --full flag for OG-style image)

**Why separate Bash calls?**
- Combining server start + screenshot in one call often fails due to timing
- `npx` needs time to download/verify packages
- Server needs time to bind to port
- Separate calls ensure each step completes before the next begins

### 7.3 Upload Process

Use `upload-image.mjs` to upload to image-bin:
```bash
node scripts/utils/upload-image.mjs --file cover-screenshot.png --hub {hub}
```

Returns the uploaded image URL for coverImage.

### 7.4 Fallback

If screenshot fails (agent-browser not available, installation fails, etc.):
- Leave coverImage empty
- Server will generate screenshot automatically on first visit

---

## 8. Analysis Workflow (Detailed Steps)

**CRITICAL: Execute in order. Each step MUST output results.**

### Step 1: Detect Project Type

Check project type and output result:

```
Project Type Detection:
- Type: [Single HTML / ZIP Archive / Static / Pre-built / Buildable / Monorepo / Unknown]
- Reason: [detected characteristics, e.g., "has index.html at root, no package.json"]
- Next action: [publish directly / need build decision / ...]
```

**Single file notes (`--file` mode):**
- Single HTML files still need full metadata analysis
- Extract title, description from the HTML file
- Detect .git/config to get githubRepo (check parent directories)
- Execute tags matching (may match "html" category)
- Generate screenshot by serving the single file

**ZIP archive notes:**
- Extract ZIP to temp directory first
- Analyze extracted content as directory
- Follow standard analysis workflow

**Static project notes:**
- Static projects (index.html at root, no package.json) still need full metadata analysis
- Extract title, description from index.html
- Detect .git/config to get githubRepo
- Execute tags matching (may match "html" category)
- Generate screenshot

### Step 2: Extract Metadata

1. **Read project files**:
   - For `--file` mode: Read the specified HTML file directly
   - For directory mode: Read `index.html` (in dist/build/out or root)
   - `package.json` (if exists)
   - `.git/config` (if exists, check parent directories for subdirectory case)
   - `README.md` (if exists)

2. **Extract by priority**:
   - title: `<title>` > `og:title` > package.json name > h1
   - description: `<meta description>` > `og:description` > package.json description
   - githubRepo: `.git/config` origin > package.json repository

3. **Output Metadata table** (REQUIRED)

### Step 3: Fetch and Match Tags

1. **Fetch cached tags**:
   ```bash
   node scripts/utils/fetch-tags.mjs --hub {hub}
   ```

2. **Parse JSON output** to get all tag types

3. **Execute matching**:
   - platformTags: Detect config files (vercel.json, netlify.toml, etc.)
   - techStackTags: Match package.json dependencies with tag.slug
   - modelTags: Scan code for AI model patterns
   - categoryTags: AI inference based on project characteristics

4. **Output Tags table** (REQUIRED)

### Step 4: Generate Screenshot

Follow the detailed instructions in **Section 7 (coverImage)** above:

1. Check and install `agent-browser` if needed (Section 7.1)
2. Start local server (Section 7.2 Step 1) - **use separate Bash call**
3. Wait for server to be ready (Section 7.2 Step 2) - **use separate Bash call**
4. Take screenshot with agent-browser (Section 7.2 Step 3) - **use separate Bash call**
5. Upload screenshot (Section 7.3)
6. Stop server (Section 7.2 Step 4) - **use separate Bash call**
7. **Output Screenshot status** (REQUIRED)

**CRITICAL: Do NOT combine server start and screenshot commands in a single Bash call.** This causes timing issues where the screenshot is attempted before the server is ready, resulting in `ERR_CONNECTION_REFUSED` errors.

**Fallback:** If screenshot fails, skip coverImage. Server will auto-generate.

### Step 5: Summarize Results

Display complete confirmation info:

```
Publishing to MyVibe:
──────────────────────
Title: [extracted value]
Description: [extracted value]
GitHub: [URL or "Not detected"]
Cover Image: [URL or "Will be auto-generated"]

Tags (auto-detected):
- Tech Stack: [matched names or "None"]
- Platform: [matched names or "None"]
- Category: [matched names or "None"]
- Model: [matched names or "None"]
```

---

## 9. Output Format

Present analysis results to user for confirmation:

```
Metadata Analysis Results:
--------------------------
Title: My Awesome App
Description: A cool web application
GitHub: https://github.com/user/repo
Cover Image: [screenshot preview]

Tags (auto-detected):
- Platform: Vercel
- Tech Stack: React, TypeScript, Tailwind CSS
- Category: Dashboard (suggested)
- Model: Claude (detected in code)

Proceed with these values? [Confirm / Edit]
```

---

## 10. Config File Format

After user confirmation, generate `publish-config.yaml`:

```yaml
source:
  type: dir
  path: ./dist
hub: https://staging.myvibe.so
metadata:
  title: My Awesome App
  description: A cool web application
  visibility: public
  coverImage: https://image-bin.arcblock.io/xxx.png
  githubRepo: https://github.com/user/repo
  platformTags: [1]
  techStackTags: [2, 3, 4]
  categoryTags: [5]
  modelTags: [6]
```

Tags use numeric IDs from the API response.
