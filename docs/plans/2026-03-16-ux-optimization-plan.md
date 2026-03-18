# UX Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dual-mode output (human/JSON), auto-retry, upload progress, and structured error handling to the publish flow.

**Architecture:** New `ux.mjs` handles all output formatting with auto-detection of AI agent environments. New `retry.mjs` provides exponential backoff. Existing modules replace `console.log`/`chalk` calls with `ux.*` API. No external dependencies added.

**Tech Stack:** Node.js ESM, vitest, chalk (existing)

**Design Doc:** `docs/plans/2026-03-16-ux-optimization-design.md`

---

### Task 1: Create `utils/ux.mjs` — Dual-Mode Output Engine

**Files:**
- Create: `skills/myvibe-publish/scripts/utils/ux.mjs`
- Test: `skills/myvibe-publish/scripts/utils/__tests__/ux.test.mjs`

**Step 1: Write the failing tests**

Create `skills/myvibe-publish/scripts/utils/__tests__/ux.test.mjs`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper: capture stdout writes
function captureStdout() {
  const writes = []
  const original = process.stdout.write
  process.stdout.write = (chunk) => {
    writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
    return true
  }
  return {
    writes,
    restore: () => {
      process.stdout.write = original
    },
  }
}

describe('ux', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('mode detection', () => {
    it('should default to human mode', async () => {
      delete process.env.CLAUDECODE
      delete process.env.CODEX
      delete process.env.GEMINI_CLI
      delete process.env.OPENCODE
      delete process.env.MYVIBE_OUTPUT
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      expect(ux.mode).toBe('human')
    })

    it('should detect CLAUDECODE env as json mode', async () => {
      process.env.CLAUDECODE = '1'
      delete process.env.MYVIBE_OUTPUT
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      expect(ux.mode).toBe('json')
    })

    it('should allow MYVIBE_OUTPUT override', async () => {
      process.env.CLAUDECODE = '1'
      process.env.MYVIBE_OUTPUT = 'human'
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      expect(ux.mode).toBe('human')
    })
  })

  describe('human mode output', () => {
    it('header should output bold text', async () => {
      delete process.env.CLAUDECODE
      delete process.env.MYVIBE_OUTPUT
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.header('MyVibe Publish')
      capture.restore()
      const output = capture.writes.join('')
      expect(output).toContain('MyVibe Publish')
    })

    it('progress should show bar', async () => {
      delete process.env.CLAUDECODE
      delete process.env.MYVIBE_OUTPUT
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.progress('upload', 50, '320KB/640KB')
      capture.restore()
      const output = capture.writes.join('')
      expect(output).toContain('50%')
    })
  })

  describe('json mode output', () => {
    it('header should output JSON event', async () => {
      process.env.MYVIBE_OUTPUT = 'json'
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.header('MyVibe Publish')
      capture.restore()
      const output = capture.writes.join('')
      const parsed = JSON.parse(output.trim())
      expect(parsed.event).toBe('phase')
      expect(parsed.message).toBe('MyVibe Publish')
    })

    it('progress should output JSON event with percent', async () => {
      process.env.MYVIBE_OUTPUT = 'json'
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.progress('upload', 50, '320KB/640KB')
      capture.restore()
      const output = capture.writes.join('')
      const parsed = JSON.parse(output.trim())
      expect(parsed.event).toBe('progress')
      expect(parsed.phase).toBe('upload')
      expect(parsed.percent).toBe(50)
    })

    it('error should include code and hint', async () => {
      process.env.MYVIBE_OUTPUT = 'json'
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.error('UPLOAD_FAILED', 'Connection reset', 'Check network')
      capture.restore()
      const output = capture.writes.join('')
      const parsed = JSON.parse(output.trim())
      expect(parsed.event).toBe('error')
      expect(parsed.code).toBe('UPLOAD_FAILED')
      expect(parsed.hint).toBe('Check network')
    })

    it('summary should output structured result', async () => {
      process.env.MYVIBE_OUTPUT = 'json'
      const { createUx } = await import('../ux.mjs')
      const ux = createUx()
      const capture = captureStdout()
      ux.summary({ success: true, did: 'z2qaXXXX', url: 'https://example.com', duration_ms: 5000 })
      capture.restore()
      const output = capture.writes.join('')
      const parsed = JSON.parse(output.trim())
      expect(parsed.event).toBe('summary')
      expect(parsed.success).toBe(true)
      expect(parsed.did).toBe('z2qaXXXX')
    })
  })

  describe('formatBytes helper', () => {
    it('should format bytes to human readable', async () => {
      const { formatBytes } = await import('../ux.mjs')
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(1024)).toBe('1.00 KB')
      expect(formatBytes(1048576)).toBe('1.00 MB')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/ux.test.mjs`
Expected: FAIL — cannot find module `../ux.mjs`

**Step 3: Write the implementation**

Create `skills/myvibe-publish/scripts/utils/ux.mjs`:

```javascript
import chalk from 'chalk'

/**
 * Detect output mode: 'json' for AI agents, 'human' for CLI users
 */
function detectMode() {
  if (process.env.MYVIBE_OUTPUT === 'json') return 'json'
  if (process.env.MYVIBE_OUTPUT === 'human') return 'human'
  const isAgent = !!(process.env.CLAUDECODE || process.env.CODEX || process.env.GEMINI_CLI || process.env.OPENCODE)
  return isAgent ? 'json' : 'human'
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * Render a text progress bar
 */
function renderProgressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
}

/**
 * Write JSON line to stdout
 */
function jsonLine(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

/**
 * Create a UX output instance
 */
export function createUx() {
  const mode = detectMode()

  return {
    mode,

    header(text) {
      if (mode === 'json') {
        jsonLine({ event: 'phase', message: text })
      } else {
        process.stdout.write(chalk.bold(`\n${text}\n\n`))
      }
    },

    step(message) {
      if (mode === 'json') {
        jsonLine({ event: 'step', message })
      } else {
        process.stdout.write(chalk.cyan(`→ ${message}\n`))
      }
    },

    progress(phase, percent, message) {
      if (mode === 'json') {
        jsonLine({ event: 'progress', phase, percent, message })
      } else {
        const bar = renderProgressBar(percent)
        process.stdout.write(`\r${bar} ${percent}% ${message || ''}`)
        if (percent >= 100) {
          process.stdout.write('\n')
        }
      }
    },

    success(message) {
      if (mode === 'json') {
        jsonLine({ event: 'success', message })
      } else {
        process.stdout.write(chalk.green(`✅ ${message}\n`))
      }
    },

    warn(message) {
      if (mode === 'json') {
        jsonLine({ event: 'warn', message })
      } else {
        process.stdout.write(chalk.yellow(`⚠️  ${message}\n`))
      }
    },

    error(code, message, hint) {
      if (mode === 'json') {
        jsonLine({ event: 'error', code, message, hint })
      } else {
        process.stdout.write(chalk.red(`\n❌ ${code}: ${message}\n`))
        if (hint) {
          process.stdout.write(chalk.yellow(`   Hint: ${hint}\n`))
        }
      }
    },

    info(message) {
      if (mode === 'json') {
        jsonLine({ event: 'info', message })
      } else {
        process.stdout.write(chalk.gray(`  ${message}\n`))
      }
    },

    summary(result) {
      if (mode === 'json') {
        jsonLine({ event: 'summary', ...result })
      } else {
        process.stdout.write('\n')
        if (result.success) {
          const lines = ['✅ Published successfully!', '']
          if (result.title) lines.push(`Title:      ${result.title}`)
          if (result.did) lines.push(`DID:        ${result.did}`)
          if (result.url) lines.push(`URL:        ${result.url}`)
          if (result.visibility) lines.push(`Visibility: ${result.visibility}`)
          if (result.duration_ms != null) lines.push(`Time:       ${(result.duration_ms / 1000).toFixed(1)}s`)

          const maxLen = Math.max(...lines.map((l) => l.length)) + 4
          process.stdout.write(chalk.green(`┌${'─'.repeat(maxLen)}┐\n`))
          for (const line of lines) {
            process.stdout.write(chalk.green(`│ ${line.padEnd(maxLen - 2)} │\n`))
          }
          process.stdout.write(chalk.green(`└${'─'.repeat(maxLen)}┘\n`))
        } else {
          process.stdout.write(chalk.red.bold('❌ Publish failed\n\n'))
          if (result.error_code) process.stdout.write(chalk.red(`Error:  ${result.error_code} — ${result.message}\n`))
          else if (result.message) process.stdout.write(chalk.red(`Error:  ${result.message}\n`))
          if (result.hint) process.stdout.write(chalk.yellow(`Hint:   ${result.hint}\n`))
          if (result.phase) {
            const retryInfo = result.retries ? ` (after ${result.retries} retries)` : ''
            process.stdout.write(chalk.gray(`Phase:  ${result.phase}${retryInfo}\n`))
          }
          if (result.duration_ms != null) process.stdout.write(chalk.gray(`Time:   ${(result.duration_ms / 1000).toFixed(1)}s\n`))
        }
        process.stdout.write('\n')
      }
    },
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/ux.test.mjs`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/ux.mjs skills/myvibe-publish/scripts/utils/__tests__/ux.test.mjs
git commit -m "feat: add dual-mode UX output engine (human/json)"
```

---

### Task 2: Create `utils/retry.mjs` — Exponential Backoff Retry

**Files:**
- Create: `skills/myvibe-publish/scripts/utils/retry.mjs`
- Test: `skills/myvibe-publish/scripts/utils/__tests__/retry.test.mjs`

**Step 1: Write the failing tests**

Create `skills/myvibe-publish/scripts/utils/__tests__/retry.test.mjs`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { retry } from '../retry.mjs'

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')
    const result = await retry(fn, { maxRetries: 3, baseDelay: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent fail'))
    await expect(retry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('persistent fail')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should not retry 4xx errors by default', async () => {
    const error = new Error('bad request')
    error.status = 400
    const fn = vi.fn().mockRejectedValue(error)
    await expect(retry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry 5xx errors', async () => {
    const error5xx = new Error('server error')
    error5xx.status = 500
    const fn = vi.fn()
      .mockRejectedValueOnce(error5xx)
      .mockResolvedValue('ok')
    const result = await retry(fn, { maxRetries: 3, baseDelay: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')
    await retry(fn, { maxRetries: 3, baseDelay: 10, onRetry })
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  })

  it('should respect custom shouldRetry', async () => {
    const customError = new Error('custom')
    customError.retryable = false
    const fn = vi.fn().mockRejectedValue(customError)
    await expect(
      retry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        shouldRetry: (err) => err.retryable !== false,
      })
    ).rejects.toThrow('custom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/retry.test.mjs`
Expected: FAIL — cannot find module `../retry.mjs`

**Step 3: Write the implementation**

Create `skills/myvibe-publish/scripts/utils/retry.mjs`:

```javascript
/**
 * Default shouldRetry: retry network errors and 5xx, not 4xx
 */
function defaultShouldRetry(error) {
  if (error.status && error.status >= 400 && error.status < 500) return false
  return true
}

/**
 * Retry a function with exponential backoff and jitter
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in ms
 * @param {Function} [options.shouldRetry] - Predicate to decide if error is retryable
 * @param {Function} [options.onRetry] - Callback on each retry (attempt, error)
 * @returns {Promise<*>} - Result of fn
 */
export async function retry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, shouldRetry = defaultShouldRetry, onRetry } = options

  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error
      }

      onRetry?.(attempt + 1, error)

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
```

**Step 4: Run tests to verify they pass**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/retry.test.mjs`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/retry.mjs skills/myvibe-publish/scripts/utils/__tests__/retry.test.mjs
git commit -m "feat: add exponential backoff retry utility"
```

---

### Task 3: Add Error Codes to `utils/constants.mjs`

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/constants.mjs`
- Test: `skills/myvibe-publish/scripts/utils/__tests__/constants.test.mjs`

**Step 1: Write the failing test**

Create `skills/myvibe-publish/scripts/utils/__tests__/constants.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest'
import { ERROR_CODES, ERROR_HINTS, getErrorHint } from '../constants.mjs'

describe('error codes', () => {
  it('should export all expected error codes', () => {
    expect(ERROR_CODES.AUTH_REQUIRED).toBe('AUTH_REQUIRED')
    expect(ERROR_CODES.AUTH_EXPIRED).toBe('AUTH_EXPIRED')
    expect(ERROR_CODES.AUTH_FAILED).toBe('AUTH_FAILED')
    expect(ERROR_CODES.UPLOAD_FAILED).toBe('UPLOAD_FAILED')
    expect(ERROR_CODES.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND')
    expect(ERROR_CODES.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE')
    expect(ERROR_CODES.UNSUPPORTED_TYPE).toBe('UNSUPPORTED_TYPE')
    expect(ERROR_CODES.CONVERT_FAILED).toBe('CONVERT_FAILED')
    expect(ERROR_CODES.CONVERT_TIMEOUT).toBe('CONVERT_TIMEOUT')
    expect(ERROR_CODES.PUBLISH_FAILED).toBe('PUBLISH_FAILED')
    expect(ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR')
  })

  it('should have hints for key error codes', () => {
    expect(ERROR_HINTS[ERROR_CODES.AUTH_EXPIRED]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.UPLOAD_FAILED]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.CONVERT_TIMEOUT]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.FILE_TOO_LARGE]).toBeDefined()
  })

  it('getErrorHint should return hint for known code', () => {
    expect(getErrorHint('UPLOAD_FAILED')).toContain('network')
  })

  it('getErrorHint should return undefined for unknown code', () => {
    expect(getErrorHint('UNKNOWN_CODE')).toBeUndefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/constants.test.mjs`
Expected: FAIL — `ERROR_CODES` is not exported

**Step 3: Add error codes to constants.mjs**

Append to `skills/myvibe-publish/scripts/utils/constants.mjs` (after line 77):

```javascript
// Structured error codes for UX
export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  CONVERT_FAILED: 'CONVERT_FAILED',
  CONVERT_TIMEOUT: 'CONVERT_TIMEOUT',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
}

export const ERROR_HINTS = {
  [ERROR_CODES.AUTH_REQUIRED]: 'Run the publish command to start authorization',
  [ERROR_CODES.AUTH_EXPIRED]: 'Run the publish command again to re-authorize',
  [ERROR_CODES.AUTH_FAILED]: 'Check your network connection and try again',
  [ERROR_CODES.UPLOAD_FAILED]: 'Check network connection. Use --skip-upload --did <DID> to retry',
  [ERROR_CODES.FILE_NOT_FOUND]: 'Verify the file path exists and is accessible',
  [ERROR_CODES.FILE_TOO_LARGE]: 'Maximum file size is 500MB. Try optimizing your build output',
  [ERROR_CODES.UNSUPPORTED_TYPE]: 'Only ZIP and HTML files are supported',
  [ERROR_CODES.CONVERT_FAILED]: 'Check your project files for errors and try again',
  [ERROR_CODES.CONVERT_TIMEOUT]: 'Try again later, the server may be busy',
  [ERROR_CODES.PUBLISH_FAILED]: 'Use --skip-upload --did <DID> to retry the publish step',
  [ERROR_CODES.NETWORK_ERROR]: 'Check your internet connection and try again',
  [ERROR_CODES.SERVER_ERROR]: 'The server encountered an error. Try again later',
}

/**
 * Get error hint for a given error code
 * @param {string} code - Error code
 * @returns {string|undefined}
 */
export function getErrorHint(code) {
  return ERROR_HINTS[code]
}
```

**Step 4: Run tests to verify they pass**

Run: `cd skills/myvibe-publish/scripts && npx vitest run utils/__tests__/constants.test.mjs`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/constants.mjs skills/myvibe-publish/scripts/utils/__tests__/constants.test.mjs
git commit -m "feat: add structured error codes with actionable hints"
```

---

### Task 4: Integrate UX + Retry into `utils/upload.mjs`

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/upload.mjs`

This task replaces `console.log(chalk.*)` calls with `ux.*` calls and adds chunked upload with progress + retry.

**Step 1: Modify upload.mjs**

Key changes to `skills/myvibe-publish/scripts/utils/upload.mjs`:

1. Replace `import chalk from 'chalk'` with `import { createUx, formatBytes } from './ux.mjs'`
2. Add `import { retry } from './retry.mjs'`
3. Add `import { ERROR_CODES } from './constants.mjs'`
4. Replace `console.log(chalk.cyan(...))` → `ux.step(...)`
5. Replace `console.log(chalk.green(...))` → `ux.success(...)`
6. Replace `console.log(chalk.gray(...))` → `ux.info(...)`
7. Wrap TUS POST (create upload) in `retry()`
8. Replace single-shot PATCH with chunked upload loop + `ux.progress()`
9. Replace `readFileAsBuffer` with `readChunk(filePath, offset, size)` for chunked reads
10. Add error codes to thrown errors: `error.errorCode = ERROR_CODES.UPLOAD_FAILED`

**Chunked upload implementation** (replaces lines 110-134):
```javascript
const CHUNK_SIZE = 256 * 1024 // 256KB

// Step 2: Upload file content in chunks with progress
const fullUploadUrl = `${origin}${uploadUrl}`
let offset = 0

while (offset < fileSize) {
  const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize)
  const chunk = await readChunk(filePath, offset, chunkEnd - offset)

  await retry(
    async () => {
      const resp = await fetch(fullUploadUrl, {
        method: 'PATCH',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': offset.toString(),
          'Content-Type': 'application/offset+octet-stream',
          Authorization: `Bearer ${accessToken}`,
          'x-uploader-file-name': uniqueFileName,
          'x-uploader-file-id': fileId,
          'x-uploader-file-ext': fileExt,
          'x-uploader-base-url': endpointPath,
          'x-uploader-endpoint-url': uploadEndpoint,
          'x-uploader-metadata': JSON.stringify({
            uploaderId,
            relativePath: uniqueFileName,
            name: uniqueFileName,
            type: mimeType,
          }),
          'x-uploader-file-exist': 'true',
        },
        body: chunk,
      })
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          await handleAuthError(hubUrl, resp.status)
        }
        const errorText = await resp.text()
        const err = new Error(`Failed to upload chunk: ${resp.status} ${resp.statusText}\n${errorText}`)
        err.status = resp.status
        throw err
      }
      // Only parse JSON on final chunk
      if (chunkEnd >= fileSize) {
        return resp
      }
    },
    {
      maxRetries: 3,
      onRetry: (attempt, error) => ux.warn(`Upload retry ${attempt}/3: ${error.message}`),
    }
  )

  offset = chunkEnd
  if (fileSize > CHUNK_SIZE) {
    ux.progress('upload', Math.round((offset / fileSize) * 100), `${formatBytes(offset)}/${formatBytes(fileSize)}`)
  }
}
```

**New readChunk function** (replaces `readFileAsBuffer`):
```javascript
import { open as fsOpen } from 'node:fs/promises'

async function readChunk(filePath, offset, size) {
  const handle = await fsOpen(filePath, 'r')
  try {
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, offset)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
```

**Step 2: Run all tests**

Run: `cd skills/myvibe-publish/scripts && npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/upload.mjs
git commit -m "feat: chunked upload with progress bar and auto-retry"
```

---

### Task 5: Integrate UX + Retry into `utils/http.mjs`

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/http.mjs`

**Step 1: Modify http.mjs**

Key changes:

1. Add `import { createUx } from './ux.mjs'` and `import { retry } from './retry.mjs'`
2. Add `import { ERROR_CODES } from './constants.mjs'`
3. Wrap `apiRequest` in `retry()` — this automatically covers `apiGet`, `apiPost`, `apiPatch`
4. Add error codes to thrown errors: set `error.errorCode` based on status
5. In `subscribeToSSE` callbacks: replace raw calls with structured progress data pass-through (no ux calls in http.mjs — let publish.mjs handle display via callbacks)
6. In `pollConversionStatus`: add `ERROR_CODES.CONVERT_TIMEOUT` to timeout error

Modify `apiRequest` (lines 11-47) to wrap with retry:
```javascript
export async function apiRequest(url, options, accessToken, hubUrl) {
  const ux = createUx()

  return retry(
    async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        let errorMessage
        let errorCode
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || response.statusText
          errorCode = errorData.code
        } catch {
          errorMessage = response.statusText
        }

        if (response.status === 401 || response.status === 403) {
          if (errorCode !== 'PRIVATE_MODE_REQUIRES_SUBSCRIPTION') {
            await handleAuthError(hubUrl, response.status)
          }
        }

        const error = new Error(errorMessage)
        error.status = response.status
        error.code = errorCode
        error.errorCode = response.status >= 500 ? ERROR_CODES.SERVER_ERROR : ERROR_CODES.NETWORK_ERROR
        throw error
      }

      return response.json()
    },
    {
      maxRetries: 3,
      onRetry: (attempt, error) => ux.warn(`API retry ${attempt}/3: ${error.message}`),
    }
  )
}
```

Add `ERROR_CODES.CONVERT_TIMEOUT` to polling timeout (line 220):
```javascript
const error = new Error('Conversion timeout')
error.errorCode = ERROR_CODES.CONVERT_TIMEOUT
throw error
```

**Step 2: Run all tests**

Run: `cd skills/myvibe-publish/scripts && npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/http.mjs
git commit -m "feat: add auto-retry to API requests with structured error codes"
```

---

### Task 6: Integrate UX into `utils/auth.mjs`

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/auth.mjs`

**Step 1: Modify auth.mjs**

Key changes:

1. Add `import { createUx } from './ux.mjs'` and `import { ERROR_CODES } from './constants.mjs'`
2. Replace all `console.log(chalk.*)` → `ux.*` calls
3. Replace `console.warn(...)` → `ux.warn(...)`
4. Add `error.errorCode = ERROR_CODES.AUTH_FAILED` to auth failure

Specific replacements:
- Line 30: `console.warn('Could not read stored token:', error.message)` → `ux.warn('Could not read stored token: ' + error.message)`
- Line 49: `console.warn('Could not save token:', error.message)` → `ux.warn('Could not save token: ' + error.message)`
- Line 63: `console.log(chalk.yellow(...))` → `ux.warn(...)`
- Line 65: `console.warn('Could not clear token:', error.message)` → `ux.warn('Could not clear token: ' + error.message)`
- Line 86: `console.log(chalk.cyan(...))` → `ux.step('Authorization required for MyVibe...')`
- Lines 109-113: `console.log(chalk.cyan(...))` → `ux.step('Please open the following URL...')`
- Line 122: `console.log(chalk.green(...))` → `ux.success('Authorization successful!')`
- Lines 126-136: Replace chalk-heavy error → set `error.errorCode = ERROR_CODES.AUTH_FAILED` and throw cleaner message
- Line 148: `console.log(chalk.yellow(...))` → `ux.warn(...)`
- Line 150: `console.log(chalk.cyan(...))` → `ux.step(...)`

**Step 2: Run all tests**

Run: `cd skills/myvibe-publish/scripts && npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/auth.mjs
git commit -m "refactor: replace chalk console.log with ux output in auth module"
```

---

### Task 7: Integrate UX into `publish.mjs` — Main Orchestration

**Files:**
- Modify: `skills/myvibe-publish/scripts/publish.mjs`

This is the largest change. It replaces all `console.log`/`console.error` with `ux.*` calls, adds timing, optimizes screenshot wait, and adds the publish summary.

**Step 1: Modify publish.mjs**

Key changes:

1. Replace `import chalk from 'chalk'` with:
   ```javascript
   import { createUx } from './utils/ux.mjs'
   import { ERROR_CODES, getErrorHint } from './utils/constants.mjs'
   ```
   Note: keep `chalk` import only for `printHelp()` function

2. Add timing at start of `publish()`:
   ```javascript
   const startTime = Date.now()
   const ux = createUx()
   ```

3. Replace all `console.log(chalk.*)` in `publish()`:
   - Line 102: `console.log(chalk.bold(...))` → `ux.header('MyVibe Publish')`
   - Line 103: `console.log(chalk.gray(...))` → `ux.info('Hub: ' + hub)`
   - Line 142: `console.log(chalk.cyan(...))` → `ux.step('Skipping upload, using existing DID: ' + did)`
   - Line 193: `console.log(chalk.cyan(...))` → `ux.step('Waiting for conversion...')`
   - Line 203: `console.log(chalk.gray(...))` → `ux.info(message)`
   - Line 207-208: `console.log(chalk.gray(...))` → `ux.info(data.message)`
   - Line 211: `console.log(chalk.green(...))` → `ux.success('Conversion completed!')`
   - Line 214: `console.log(chalk.red(...))` → `ux.error(ERROR_CODES.CONVERT_FAILED, error)`
   - Line 219: `console.log(chalk.yellow(...))` → `ux.warn('SSE connection failed, using polling...')`
   - Line 222: `console.log(chalk.gray(...))` → `ux.info('Status: ' + status.status)`
   - Lines 224-229: Same pattern as SSE callbacks
   - Line 239: `console.log(chalk.cyan(...))` → `ux.step('Checking for screenshot...')`
   - Line 248: `console.log(chalk.cyan(...))` → `ux.step('Publishing...')`

4. **Optimize screenshot wait** — modify `readScreenshotResult`:
   - Change defaults: `maxRetries = 5`, `retryDelay = 2000`
   - Replace `console.log` calls with `ux.*`:
     - Line 35: → `ux.success('Screenshot ready: ' + result.url)`
     - Line 39: → `ux.warn('Screenshot generation failed: ' + (result.error || 'Unknown error'))`
     - Line 45: → `ux.warn('Failed to read screenshot result: ' + error.message)`
     - Lines 50-51: → `ux.info('Waiting for screenshot... (' + remainingSeconds + 's remaining)')`
       where `remainingSeconds = Math.ceil((maxRetries - attempt) * retryDelay / 1000)`
     - Line 57: → `ux.warn('Screenshot not available, proceeding without cover')`

5. **Replace publish action error handling** (lines 269-281):
   ```javascript
   let actionResult
   try {
     actionResult = await apiPatch(actionUrl, actionData, accessToken, hub)
   } catch (actionError) {
     const duration_ms = Date.now() - startTime
     ux.error(ERROR_CODES.PUBLISH_FAILED, actionError.message, getErrorHint(ERROR_CODES.PUBLISH_FAILED))
     ux.info(`Upload was successful. DID: ${did}`)
     ux.summary({
       success: false,
       error_code: ERROR_CODES.PUBLISH_FAILED,
       message: actionError.message,
       hint: `Use --skip-upload --did ${did} to retry`,
       did,
       phase: 'publish',
       duration_ms,
     })
     return { success: false, error: actionError.message, did, retryHint: 'skip-upload' }
   }
   ```

6. **Replace success output** (lines 283-334) with summary:
   ```javascript
   if (actionResult.success) {
     let vibeUrl = actionResult.contentUrl
     if (!vibeUrl) {
       const vibeInfoUrl = joinURL(apiBaseUrl, API_PATHS.VIBE_INFO(did))
       const vibeInfo = await apiGet(vibeInfoUrl, accessToken, hub)
       vibeUrl = joinURL(hub, vibeInfo.userDid, did)
     }

     if (existingDid && versionHistoryEnabled === false) {
       const pricingUrl = joinURL(hub, 'pricing')
       ux.warn('Previous version overwritten. Want to keep version history?')
       ux.info('Upgrade to Creator: ' + pricingUrl)
     }

     // ... (keep history save + cleanup logic unchanged) ...

     const duration_ms = Date.now() - startTime
     ux.summary({
       success: true,
       did,
       url: vibeUrl,
       title: title || undefined,
       visibility,
       duration_ms,
     })

     return { success: true, did, url: vibeUrl }
   }
   ```

7. **Replace catch block** (lines 338-343):
   ```javascript
   } catch (error) {
     const duration_ms = Date.now() - startTime
     const errorCode = error.errorCode || ERROR_CODES.NETWORK_ERROR
     ux.summary({
       success: false,
       error_code: errorCode,
       message: error.message,
       hint: getErrorHint(errorCode),
       duration_ms,
     })
     return { success: false, error: error.message }
   }
   ```

8. **Replace CLI fatal error** (line 621):
   ```javascript
   } catch (error) {
     const ux = createUx()
     ux.error('FATAL', error.message)
     process.exit(1)
   }
   ```

**Step 2: Run all tests**

Run: `cd skills/myvibe-publish/scripts && npx vitest run`
Expected: All tests PASS

**Step 3: Run lint and format**

Run: `cd skills/myvibe-publish/scripts && npx eslint . && npx prettier --check .`
Expected: PASS (fix any issues with `npx eslint . --fix && npx prettier --write .`)

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/publish.mjs
git commit -m "feat: replace console output with ux engine, add timing and publish summary"
```

---

### Task 8: Final Verification

**Files:** All modified files

**Step 1: Run full test suite**

Run: `cd skills/myvibe-publish/scripts && npx vitest run`
Expected: All tests PASS

**Step 2: Run lint**

Run: `cd skills/myvibe-publish/scripts && npx eslint .`
Expected: No errors

**Step 3: Run format check**

Run: `cd skills/myvibe-publish/scripts && npx prettier --check .`
Expected: All files formatted

**Step 4: Verify help output still works**

Run: `cd skills/myvibe-publish/scripts && node publish.mjs --help`
Expected: Help text displays correctly (this still uses chalk directly)

**Step 5: Verify JSON mode output**

Run: `cd skills/myvibe-publish/scripts && MYVIBE_OUTPUT=json node publish.mjs --help`
Expected: Help text displays (help bypasses ux engine)

---

## Dependency Graph

```
Task 1 (ux.mjs) ─────┐
Task 2 (retry.mjs) ───┤
Task 3 (constants) ────┼── Task 4 (upload.mjs) ──┐
                       ├── Task 5 (http.mjs) ─────┼── Task 7 (publish.mjs) ── Task 8 (verify)
                       └── Task 6 (auth.mjs) ─────┘
```

Tasks 1, 2, 3 can be done in parallel.
Tasks 4, 5, 6 can be done in parallel (after 1-3).
Task 7 depends on all prior tasks.
Task 8 is final verification.
