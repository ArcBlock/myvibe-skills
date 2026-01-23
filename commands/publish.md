---
description: Publish static HTML, ZIP archive, or directory to MyVibe
---

# Publish Command

This command publishes web content to MyVibe.

## Usage

```
/my-vibe:publish [options]
```

## Options

- `--file <path>` or `-f`: Path to HTML file or ZIP archive
- `--dir <path>` or `-d`: Directory to compress and publish
- `--url <url>` or `-u`: URL to import and publish
- `--hub <url>` or `-h`: MyVibe URL (default: https://staging.myvibe.so/)
- `--title <title>` or `-t`: Project title
- `--desc <desc>`: Project description
- `--visibility <vis>` or `-v`: Visibility: public or private (default: public)

## Execution

Use the `my-vibe:my-vibe-publish` skill to execute the publish workflow:

The skill will:
1. Analyze the content to extract metadata (title, description)
2. Confirm publishing details with the user
3. Execute the publish script
4. Return the published URL
