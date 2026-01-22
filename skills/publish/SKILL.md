---
name: publish
description: Publish static HTML, ZIP archive, or directory to Vibe Hub. Use this skill when user wants to publish/deploy web content to Vibe Hub.
---

# Vibe Hub Publish

Publish web content (HTML file, ZIP archive, or directory) to Vibe Hub.

## Usage

```bash
# Publish a ZIP file
/vibe-hub:publish --file ./dist.zip

# Publish a single HTML file
/vibe-hub:publish --file ./index.html

# Publish a directory (auto-zip)
/vibe-hub:publish --dir ./dist

# Import and publish from URL
/vibe-hub:publish --url https://example.com/my-app

# Publish to specific vibe-hub instance
/vibe-hub:publish --file ./dist.zip --hub https://custom-hub.com
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to compress and publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | Vibe Hub URL (default: https://staging.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |

## Workflow

### 1. Analyze Content

Before publishing, analyze the content to extract meaningful metadata:

**For HTML files:**
- Read the file using Read tool
- Extract `<title>` tag content
- Extract `<meta name="description">` content
- Extract `<meta property="og:title">` and `<meta property="og:description">`
- Look at `<h1>` tags for main heading
- Analyze page content to understand the purpose

**For directories/ZIP:**
- Read `index.html` and analyze as above
- Read `package.json` for `name` and `description` fields
- Read `README.md` for project title and introduction
- Read `manifest.json` for PWA app information
- Analyze file structure to determine project type (game, tool, landing page, etc.)

**For URL import:**
- Fetch page and extract `<title>`, meta description
- Extract Open Graph tags
- Analyze page content

### 2. Confirm with User

After analysis, present the extracted/generated information to the user:

```
Publishing to Vibe Hub:
- Title: [extracted or generated title]
- Description: [extracted or generated description]
- Visibility: public
- Source: [file path / directory / URL]

Confirm publish? (or provide corrections)
```

If information is uncertain or missing, use AskUserQuestion to ask the user.

### 3. Execute Publish

Only after user confirmation, execute the publish script:

```bash
# Install dependencies if needed
cd skills/publish/scripts && npm install

# Execute publish
node skills/publish/scripts/publish.mjs \
  --file ./dist.zip \
  --hub https://staging.myvibe.so \
  --title "My App" \
  --desc "A cool app" \
  --visibility public
```

### 4. Return Result

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
