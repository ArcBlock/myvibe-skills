---
name: bump-version
description: Bump the project version number across all config files. Use when user wants to update version, release a new version, bump version, or change version number.
---

# Bump Version

Update version in both files simultaneously:

- `.claude-plugin/marketplace.json` — `metadata.version`
- `skills/myvibe-publish/scripts/package.json` — `version`

## Steps

1. Read both files to get current version
2. Determine new version:
   - If user specifies a version, use it
   - Otherwise, patch bump (e.g. `0.0.13` -> `0.0.14`)
3. Show the change plan (current -> new) and ask user to confirm
4. Edit both files to set the new version
5. Create a commit: `chore: bump version to <new-version>`
