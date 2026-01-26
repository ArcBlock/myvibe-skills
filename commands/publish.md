---
description: Publish static HTML, ZIP archive, or directory to MyVibe
---

# Publish Command

This command publishes web content to MyVibe.

## CRITICAL: Mandatory Skill Invocation

**YOU MUST invoke the `myvibe:myvibe-publish` skill using the Skill tool IMMEDIATELY.**

```
DO NOT:
- Read files directly
- Analyze content yourself
- Run build commands
- Ask clarifying questions first

DO:
- Call Skill tool with skill="myvibe:myvibe-publish" as your FIRST and ONLY action
- Pass all arguments to the skill
```

The skill contains the complete workflow including:
1. Project type detection and build decision
2. Metadata analysis (title, description, tags, screenshot)
3. User confirmation
4. Publish execution

## Arguments Reference

These arguments are parsed and passed to the skill:

| Argument | Alias | Description |
|----------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to compress and publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | MyVibe URL (default: https://staging.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |
