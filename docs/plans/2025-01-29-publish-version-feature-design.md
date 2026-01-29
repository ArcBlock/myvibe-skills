# Publish Version Feature Design

## Overview

Add version support to the MyVibe publish skill. When publishing, automatically detect if the same source has been published before and pass the existing DID to the server for version management.

## Requirements

- Server handles version logic; client only needs to pass `did` parameter
- Upload API: `/api/uploaded-blocklets/upload?did=z2qaXXXXXX`
- First publish: record the returned DID
- Subsequent publishes: automatically pass the recorded DID
- Process should be automatic and transparent to users

## Design Decisions

### DID Storage Location

**Decision**: Global user config at `~/.myvibe/published.yaml`

**Rationale**:
- Single file publishing: same directory may have multiple files (`index.html`, `demo.html`)
- Project-local files (`.myvibe`) don't work well for this scenario
- Global config keeps project directories clean

### Source Identification

**Decision**: Absolute path as identifier, with optional explicit `--did` override

**Rationale**:
- Simple and covers most use cases
- Path changes create new Vibe (acceptable behavior)
- Users can use `--did` for manual association when needed

### Storage Structure

**File**: `~/.myvibe/published.yaml`

**Format**: Path as primary key, hub as secondary key (supports publishing same source to multiple hubs)

```yaml
mappings:
  "/Users/lban/projects/app/dist":
    "https://www.myvibe.so":
      did: "z2qaXXXXXX"
      lastPublished: "2025-01-29T10:30:00Z"
      title: "My App"
    "https://staging.myvibe.so":
      did: "z2qaYYYYYY"
      lastPublished: "2025-01-28T15:00:00Z"
      title: "My App Staging"

  "/Users/lban/projects/demo/index.html":
    "https://www.myvibe.so":
      did: "z2qaZZZZZZ"
      lastPublished: "2025-01-28T15:00:00Z"
      title: "Demo Page"
```

## Publish Flow

```
1. Resolve source to absolute path
2. Query ~/.myvibe/published.yaml for [path][hub] mapping
3. Upload file → POST /api/uploaded-blocklets/upload?did=xxx (if mapping exists)
4. Convert → Publish
5. On success, update ~/.myvibe/published.yaml with new/updated mapping
```

## DID Resolution Priority

1. CLI `--did` parameter (highest)
2. Config file `did` field
3. Auto-lookup from `~/.myvibe/published.yaml`
4. No DID (first publish)

## New Parameters

| Option | Description |
|--------|-------------|
| `--did <did>` | Explicitly specify Vibe DID to update (overrides auto-detection) |
| `--new` | Force create new Vibe, ignore publish history |

## Config File Support

```yaml
source:
  type: dir
  path: ./dist
  did: z2qaXXXXXX  # Optional, explicit DID
hub: https://www.myvibe.so
metadata:
  title: My App
  # ... other fields
```

## Implementation Changes

1. **New `~/.myvibe/published.yaml`**: Store path-hub-did mappings
2. **New `utils/history.mjs`**: Handle mapping read/write operations
3. **Modify `upload.mjs`**: `uploadFile()` accepts optional `did` parameter
4. **Modify `constants.mjs`**: `API_PATHS.UPLOAD` supports query parameter
5. **Modify `publish.mjs`**: Integrate DID lookup/save logic
6. **Update `SKILL.md`**: Document new parameters

## User Experience

- Transparent: no special prompts about versioning (it's a paid feature)
- Output remains consistent with current behavior
- Users can force new Vibe with `--new` parameter
