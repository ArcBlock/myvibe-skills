# Metadata Analysis Reference

This document describes how to analyze and extract metadata for MyVibe publish.

## Field Overview

| Field | Source | Method |
|-------|--------|--------|
| `title` | HTML/package.json | Rule-based extraction |
| `description` | HTML/package.json | Rule-based extraction |
| `coverImage` | Browser screenshot | Playwright MCP + upload |
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

**Check sources:**
1. `.git/config` - parse `[remote "origin"]` URL
2. `package.json` - `repository` field (string or object with `url`)
3. `package.json` - `homepage` field (if github.com)

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

Screenshot the rendered page and upload.

### 7.1 Screenshot Process

**Using Playwright MCP:**
1. Start local server: `npx serve {dir} -p 3456`
2. Navigate: `browser_navigate` to `http://localhost:3456`
3. Wait for page load
4. Screenshot: `browser_take_screenshot` with filename
5. Stop server

**Screenshot settings:**
- Size: 1200x630 (standard OG image ratio)
- Format: PNG
- Full page: No (viewport only)

### 7.2 Upload Process

Use `upload-image.mjs` to upload to image-bin:
```bash
node scripts/utils/upload-image.mjs --file screenshot.png --hub {hub}
```

Returns the uploaded image URL for coverImage.

### 7.3 Fallback

If screenshot fails:
- Leave coverImage empty
- Server will generate screenshot automatically on first visit

---

## 8. Analysis Workflow

```
1. Get cached tags
   - Run: node scripts/utils/fetch-tags.mjs --hub {hub}
   - Parse JSON output to get all tag types

2. Read project files
   - package.json (if exists)
   - index.html (in dist/build/out or root)
   - README.md (if exists)
   - .git/config (if exists)

3. Extract basic metadata
   - title (rule-based)
   - description (rule-based)
   - githubRepo (rule-based)

4. Match tags against cached data
   - platformTags (rule-based, match slug)
   - techStackTags (rule-based, match slug)
   - modelTags (pattern-based)
   - categoryTags (AI inference from available tags)

5. Generate screenshot
   - Start server
   - Take screenshot with Playwright MCP
   - Upload image
   - Get coverImage URL

6. Compile results
   - All extracted/matched values
   - Confidence indicators for AI-inferred values
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

After user confirmation, generate `publish-config.json`:

```json
{
  "source": {
    "type": "dir",
    "path": "./dist"
  },
  "metadata": {
    "title": "My Awesome App",
    "description": "A cool web application",
    "visibility": "public",
    "coverImage": "https://image-bin.arcblock.io/xxx.png",
    "githubRepo": "https://github.com/user/repo",
    "platformTags": [1],
    "techStackTags": [2, 3, 4],
    "categoryTags": [5],
    "modelTags": [6]
  }
}
```

Tags use numeric IDs from the API response.
