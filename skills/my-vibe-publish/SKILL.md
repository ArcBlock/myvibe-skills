---
name: my-vibe-publish
description: Publish static HTML, ZIP archive, or directory to MyVibe. Use this skill when user wants to publish/deploy web content to MyVibe.
---

# MyVibe Publish

Publish web content (HTML file, ZIP archive, or directory) to MyVibe.

## Usage

```bash
# Publish a ZIP file
/my-vibe:my-vibe-publish --file ./dist.zip

# Publish a single HTML file
/my-vibe:my-vibe-publish --file ./index.html

# Publish a directory (auto-zip)
/my-vibe:my-vibe-publish --dir ./dist

# Import and publish from URL
/my-vibe:my-vibe-publish --url https://example.com/my-app

# Publish to specific my-vibe instance
/my-vibe:my-vibe-publish --file ./dist.zip --hub https://custom-hub.com
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to compress and publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | MyVibe URL (default: https://staging.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |

## Workflow

### 1. Analyze Content & Detect Project Type

Determine the target directory to analyze:
- If `--dir` specified: analyze that directory
- If `--file` specified: skip to Step 3 (publish file directly)
- Otherwise: analyze current working directory

#### Project Type Detection (in priority order)

| Check | Project Type | Action |
|-------|-------------|--------|
| Has `dist/index.html`, `build/index.html`, or `out/index.html` | **Pre-built** | Go to Step 2 (confirm rebuild or use existing) |
| Has `package.json` with `build` script, no output folder | **Buildable** | Go to Step 2 (Build Decision) |
| Has multiple `package.json` files or workspace config | **Monorepo** | Ask user which app to build |
| Has `index.html` at root, no `package.json` | **Static** | Publish directly |
| Cannot determine | **Unknown** | Publish as-is, let server handle |

#### Metadata Extraction

Extract metadata from available sources:

**For HTML files:**
- Extract `<title>` tag content
- Extract `<meta name="description">` content
- Extract `<meta property="og:title">` and `<meta property="og:description">`
- Look at `<h1>` tags for main heading

**For directories:**
- Read `index.html` and analyze as above
- Read `package.json` for `name` and `description` fields
- Read `README.md` for project title and introduction

**For URL import:**
- Fetch page and extract `<title>`, meta description
- Extract Open Graph tags

### 2. Build Decision (for Pre-built/Buildable/Monorepo projects)

#### Detect Build Configuration

**Package Manager** (from lock files):

| Lock File | Package Manager |
|-----------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` or `bun.lock` | bun |
| `package-lock.json` | npm |
| None | npm (default) |

**Build Command** (from `package.json` scripts):
- Priority: `build:prod` > `build:production` > `build`

**Output Directory** (from config files):

| Config File | Expected Output |
|-------------|-----------------|
| `vite.config.*` | `dist` |
| `next.config.*` | `.next` or `out` |
| `webpack.config.*` | `dist` |
| `astro.config.*` | `dist` |
| `nuxt.config.*` | `.output` |
| None recognized | Check `dist`, `build`, `out` in order |

#### Show Analysis & Confirm Build

Present the analysis to user:

```
Project Analysis:
- Type: [framework] project
- Package Manager: [pm]
- Build Command: [pm] run build
- Output Directory: [dir]

Warnings (if any):
- Missing .env file (.env.example exists)
- Large files detected (> 10MB)
```

**For Pre-built projects** (existing build output found), use `AskUserQuestion`:

```
Question: "Found existing build output in [dir]/. Rebuild to ensure latest?"
Header: "Build"
Options:
  - Label: "Rebuild & Publish"
    Description: "Run build again, then publish [dir]/"
  - Label: "Use Existing"
    Description: "Publish existing [dir]/ without rebuilding"
  - Label: "Publish Source"
    Description: "Skip output folder, publish source as-is"
```

**For Buildable projects** (no build output), use `AskUserQuestion`:

```
Question: "Proceed with build before publishing?"
Header: "Build"
Options:
  - Label: "Build & Publish"
    Description: "Run build, then publish [output_dir]/"
  - Label: "Publish Source"
    Description: "Skip build, publish source as-is"
```

#### Execute Build (if confirmed)

```bash
cd [project_dir] && [pm] install && [pm] run build
```

**On build failure:**
- Analyze error output
- Offer to help fix common issues (missing dependencies, config errors)
- User can choose to fix and retry, or publish source as-is

#### Monorepo Handling

When multiple `package.json` files detected, use `AskUserQuestion`:

```
Question: "Monorepo detected. Which app would you like to publish?"
Header: "App"
Options:
  - Label: "[apps/web]"
    Description: "[framework] detected in apps/web"
  - Label: "[apps/admin]"
    Description: "[framework] detected in apps/admin"
  - Label: "Other"
    Description: "Specify a different path"
```

### 3. Confirm Publish

Present the extracted/generated information to the user:

```
Publishing to MyVibe:
- Title: [extracted or generated title]
- Description: [extracted or generated description]
- Visibility: public
- Source: [file path / directory / URL]
```

Use `AskUserQuestion` to confirm:

```
Question: "Confirm publish to MyVibe?"
Header: "Publish"
Options:
  - Label: "Publish"
    Description: "Publish with the details shown above"
  - Label: "Edit details"
    Description: "Modify title, description, or visibility before publishing"
```

If user selects "Edit details" or "Other", use follow-up `AskUserQuestion` to collect corrections.

### 4. Execute Publish

Only after user confirmation, execute the publish script:

**Dependency Check Strategy:**
1. Check if `skills/my-vibe-publish/scripts/node_modules` directory exists
2. If exists: skip `npm install`, run publish directly
3. If publish fails with module errors: run `npm install` and retry
4. If `node_modules` doesn't exist: run `npm install` first

```bash
# Check if dependencies installed (node_modules exists)
# If YES: run publish directly
node skills/my-vibe-publish/scripts/publish.mjs ...

# If publish fails with "Cannot find module" or similar error:
cd skills/my-vibe-publish/scripts && npm install
# Then retry publish

# If node_modules doesn't exist: install first
cd skills/my-vibe-publish/scripts && npm install
node skills/my-vibe-publish/scripts/publish.mjs ...
```

**Examples:**

```bash
# Publish a ZIP file
node skills/my-vibe-publish/scripts/publish.mjs \
  --file ./dist.zip \
  --hub https://staging.myvibe.so \
  --title "My App" \
  --desc "A cool app" \
  --visibility public

# Publish a directory (auto-zipped)
node skills/my-vibe-publish/scripts/publish.mjs \
  --dir ./dist \
  --hub https://staging.myvibe.so \
  --title "My App" \
  --desc "A cool app" \
  --visibility public

# Publish a single HTML file
node skills/my-vibe-publish/scripts/publish.mjs \
  --file ./index.html \
  --hub https://staging.myvibe.so \
  --title "My App" \
  --desc "A cool app" \
  --visibility public

# Import and publish from URL
node skills/my-vibe-publish/scripts/publish.mjs \
  --url https://example.com/my-app \
  --hub https://staging.myvibe.so \
  --title "My App" \
  --desc "A cool app" \
  --visibility public
```

**Script Output:**

On success, the script outputs the published URL:
```
Published successfully!
URL: https://staging.myvibe.so/p/{projectId}
```

The URL format is `{hub}/p/{projectId}`, where `projectId` is generated by MyVibe.

### 5. Return Result

- On success: Show the published URL to the user
- On failure: Show the error message and suggest solutions

## Error Handling

| Error | Handling |
|-------|----------|
| Dependencies not installed | Run `npm install` in scripts directory |
| 401/403 Authorization error | Token will be cleared automatically, re-run to authorize again |
| Upload failed | Show error message, suggest checking file format |
| Conversion failed | Show conversion error from API |
| Network error | Suggest retry |
| Build failed | Analyze error, offer to help fix, or publish source as-is |
| Missing dependencies | Run `[pm] install` first |
| Config error | Check framework config files |

## Authorization

The script handles authorization automatically:
- First run opens browser for user to authorize
- Token is saved for future use
- On 401/403 errors, token is cleared and user needs to re-authorize on next run

## Notes

- Always analyze content before publishing to generate meaningful title/description
- Never use directory names as title - they are often meaningless
- Confirm with user before executing publish
- Default hub is https://staging.myvibe.so/
- Local build detection is preprocessing only; server has its own build pipeline
- Be conservative: if project type is uncertain, publish as-is and let server handle
- `--dir` specifies target directory but still needs project type analysis
- `--file` publishes the file directly without analysis
- Build detection should not block publishing
