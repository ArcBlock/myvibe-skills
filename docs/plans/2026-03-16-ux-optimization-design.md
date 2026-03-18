# UX Optimization Design — Dual-Mode Output + Retry + Progress

**Date:** 2026-03-16
**Status:** Approved
**Approach:** B — UX Layer Abstraction

## Context

After completing security hardening and CI/CD pipeline, the publish flow's user experience needs optimization. The tool serves both AI agents (Claude Code, Cursor, Codex, Gemini CLI) and human developers via CLI, requiring a dual-mode output strategy.

## Pain Points

1. **No upload progress** — file uploaded in one shot, no feedback during transfer
2. **No auto-retry** — network failures require manual re-run
3. **Vague conversion progress** — SSE messages print raw gray text
4. **Blocking screenshot wait** — up to 30s of cryptic retry messages
5. **Inconsistent error messages** — no error codes, no actionable hints
6. **No publish summary** — success/failure lacks structured recap

## Design

### 1. Dual-Mode Output Engine — `utils/ux.mjs` (~150 lines)

**Mode Detection:**
- Auto-detect AI agent via env vars (`CLAUDECODE`, `CODEX`, `GEMINI_CLI`, `OPENCODE`)
- Explicit override via `MYVIBE_OUTPUT=json|human`
- Default: agent → JSON, otherwise → human

**Core API:**

| Method | Purpose | Human Mode | JSON Mode |
|--------|---------|-----------|----------|
| `ux.header(text)` | Phase title | `chalk.bold(...)` | `{"event":"phase","phase":"..."}` |
| `ux.step(msg)` | Step info | `chalk.cyan('→ ...')` | `{"event":"step","message":"..."}` |
| `ux.progress(phase, percent, msg)` | Progress | `[████░░░░] 50% ...` | `{"event":"progress","phase":"...","percent":50}` |
| `ux.success(msg)` | Success | `chalk.green('✅ ...')` | `{"event":"success","message":"..."}` |
| `ux.warn(msg)` | Warning | `chalk.yellow('⚠️ ...')` | `{"event":"warn","message":"..."}` |
| `ux.error(code, msg, hint)` | Error | Red text + hint | `{"event":"error","code":"...","hint":"..."}` |
| `ux.summary(result)` | Publish recap | Formatted box | `{"event":"summary",...}` |

**Progress Bar (Human Mode):**
Pure text, no external deps, adapts to terminal width:
```
[████████████░░░░░░░░] 60% Uploading main.zip (384KB/640KB)
```

**JSON Mode:**
One JSON object per line for easy parsing:
```json
{"event":"progress","phase":"upload","percent":60,"message":"Uploading main.zip"}
```

### 2. Retry Mechanism — `utils/retry.mjs` (~50 lines)

**Strategy:** Exponential backoff with jitter

```
Retry 1: 1s + random(0~500ms)
Retry 2: 2s + random(0~500ms)
Retry 3: 4s + random(0~500ms)
```

**API:**
```javascript
await retry(fn, {
  maxRetries: 3,
  baseDelay: 1000,
  shouldRetry: (error) => !(error.status >= 400 && error.status < 500),
  onRetry: (attempt, error) => ux.warn(`Retry ${attempt}/3: ${error.message}`)
})
```

**Retry Coverage:**

| Operation | Retry | Reason |
|-----------|-------|--------|
| File upload (TUS create + patch) | 3x | Most common network flake point |
| API calls (publish action) | 3x | Occasional 5xx |
| SSE connection | No | Already has polling fallback |
| Auth flow | No | Requires user interaction |
| Screenshot read | No | Already has built-in polling |

### 3. Upload Progress

Replace single-shot upload with chunked transfer:

- **Chunk size:** 256KB
- **Small files (<256KB):** single upload, no progress bar
- **Large files:** chunked + `ux.progress()` + per-chunk retry
- Uses TUS protocol's `Upload-Offset` for resume support

### 4. Conversion Progress

Parse SSE `progress` events, map to `ux.progress()`:

- If server provides percentage → show progress bar
- If no percentage data → show step-style hints (`Step 1/3: Extracting...`)
- Polling fallback also connects to `ux.progress()`

### 5. Screenshot Wait Optimization

- **Reduce default wait:** 5 retries × 2s = 10s max (was 10 × 3s = 30s)
- **Show countdown:** `Waiting for screenshot... (8s remaining)`
- **Early exit:** skip if conversion was very fast (<5s)

### 6. Structured Error Codes

```javascript
export const ERROR_CODES = {
  AUTH_REQUIRED:    'AUTH_REQUIRED',
  AUTH_EXPIRED:     'AUTH_EXPIRED',
  AUTH_FAILED:      'AUTH_FAILED',
  UPLOAD_FAILED:    'UPLOAD_FAILED',
  FILE_NOT_FOUND:   'FILE_NOT_FOUND',
  FILE_TOO_LARGE:   'FILE_TOO_LARGE',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  CONVERT_FAILED:   'CONVERT_FAILED',
  CONVERT_TIMEOUT:  'CONVERT_TIMEOUT',
  PUBLISH_FAILED:   'PUBLISH_FAILED',
  NETWORK_ERROR:    'NETWORK_ERROR',
  SERVER_ERROR:     'SERVER_ERROR',
}
```

Each error code has a corresponding hint:

```javascript
const ERROR_HINTS = {
  AUTH_EXPIRED:    'Run the publish command again to re-authorize',
  UPLOAD_FAILED:   'Check network connection. Use --skip-upload --did <DID> to retry',
  CONVERT_TIMEOUT: 'Try again later, the server may be busy',
  FILE_TOO_LARGE:  'Maximum file size is 500MB. Try optimizing your build output',
}
```

### 7. Publish Result Summary

**Success (Human):**
```
┌─────────────────────────────────┐
│ ✅ Published successfully!       │
│                                 │
│ Title:  My Cool App             │
│ DID:    z2qaXXXX                │
│ URL:    https://myvibe.so/...   │
│ Mode:   public                  │
│ Time:   12.3s                   │
└─────────────────────────────────┘
```

**Success (JSON):**
```json
{"event":"summary","success":true,"did":"z2qaXXXX","url":"...","title":"My Cool App","visibility":"public","duration_ms":12300}
```

**Failure (Human):**
```
❌ Publish failed

Error:  UPLOAD_FAILED — Connection reset
Hint:   Check network connection. Use --skip-upload --did z2qaXXXX to retry
Phase:  upload (after 3 retries)
Time:   8.5s
```

**Failure (JSON):**
```json
{"event":"summary","success":false,"error_code":"UPLOAD_FAILED","message":"Connection reset","hint":"...","phase":"upload","retries":3,"duration_ms":8500}
```

Timing: record `startTime = Date.now()` at `publish()` entry.

## Files Changed

| File | Change | ~Lines |
|------|--------|--------|
| **NEW** `utils/ux.mjs` | Dual-mode output engine | ~150 |
| **NEW** `utils/retry.mjs` | Exponential backoff retry | ~50 |
| **MOD** `utils/constants.mjs` | Error code enums + hints | +30 |
| **MOD** `utils/upload.mjs` | Chunked upload + ux + retry | ~100 changed |
| **MOD** `utils/http.mjs` | Retry for API calls + ux | ~50 changed |
| **MOD** `publish.mjs` | Replace console.log → ux.*, add timing + summary | ~80 changed |

## Non-Goals

- No changes to CLI arguments or return value structure
- No external dependencies added (progress bar is pure text)
- No changes to SKILL.md workflow documentation (separate task)
