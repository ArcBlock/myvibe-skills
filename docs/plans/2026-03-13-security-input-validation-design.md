# Security Hardening: Input Validation

Date: 2026-03-13
Status: Approved
Approach: Minimal invasion — add validation at function entry points, no architecture changes

## Problem

The publish workflow lacks input validation at multiple entry points:

1. **Hub URL** — No protocol check, accepts `file://`, `ftp://`, potential SSRF
2. **File paths** — No path traversal prevention (`--dir ../../etc`)
3. **File size** — No upload size limit
4. **Token format** — `save-token.mjs` accepts any string
5. **Visibility** — Accepts arbitrary strings instead of `public`/`private`
6. **SSE timeout** — `subscribeToSSE` can hang indefinitely
7. **Temp path** — Hardcoded `/tmp`, not cross-platform, predictable

## Solution

### Validation Functions (in `utils/constants.mjs`)

| Function | Purpose |
|----------|---------|
| `validateHubUrl(url)` | HTTPS only (localhost http allowed for dev) |
| `validateFilePath(path)` | Must be within `process.cwd()` |
| `validateFileSize(size)` | Max 500MB |
| `validateVisibility(vis)` | Enum: `public`, `private` |
| `validateToken(token)` | Non-empty string, 10-1024 chars |

### Integration Points

| File | Change |
|------|--------|
| `publish.mjs` | Call `validateHubUrl`, `validateVisibility`, `validateFilePath` |
| `save-token.mjs` | Call `validateToken`, `validateHubUrl` |
| `upload.mjs` | Call `validateFileSize` after `stat()` |
| `http.mjs` | Add `AbortController` + 5min timeout to SSE |
| `constants.mjs` | Replace `/tmp` with `os.tmpdir()`, add validation functions |

### Test Plan

- Framework: Vitest (devDependency only)
- File: `utils/__tests__/validation.test.mjs`
- ~20 test cases covering all validation functions
- 100% coverage on validation logic

## Constraints

- No new production dependencies
- No architecture changes
- No changes to existing logic flow
- ~60 lines added, 0 lines removed (except `/tmp` replacement)
