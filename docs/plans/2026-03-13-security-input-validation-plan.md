# Security Input Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add input validation to all entry points in the publish workflow to prevent SSRF, path traversal, oversized uploads, and invalid inputs.

**Architecture:** Add pure validation functions to `utils/constants.mjs`, call them at existing entry points in `publish.mjs`, `save-token.mjs`, `upload.mjs`. Add SSE timeout to `http.mjs`. Fix cross-platform temp path. All changes are additive — no existing logic is modified.

**Tech Stack:** Node.js ESM, Vitest for testing

---

### Task 1: Set up Vitest

**Files:**
- Modify: `skills/myvibe-publish/scripts/package.json`

**Step 1: Install Vitest**

Run:
```bash
cd skills/myvibe-publish/scripts && npm install --save-dev vitest
```

**Step 2: Add test scripts to package.json**

Change `scripts` in `package.json` to:
```json
{
  "scripts": {
    "publish": "node publish.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Verify Vitest works**

Run:
```bash
cd skills/myvibe-publish/scripts && npx vitest run 2>&1 | head -5
```
Expected: No tests found (or similar), no crash.

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/package.json skills/myvibe-publish/scripts/package-lock.json
git commit -m "chore: add vitest for testing"
```

---

### Task 2: Add validation functions and tests (TDD)

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/constants.mjs`
- Create: `skills/myvibe-publish/scripts/utils/__tests__/validation.test.mjs`

**Step 1: Write the failing tests**

Create `skills/myvibe-publish/scripts/utils/__tests__/validation.test.mjs`:

```javascript
import { describe, it, expect } from "vitest";
import {
  validateHubUrl,
  validateFilePath,
  validateFileSize,
  validateVisibility,
  validateToken,
  MAX_UPLOAD_SIZE,
} from "../constants.mjs";

describe("validateHubUrl", () => {
  it("accepts https URL", () => {
    const result = validateHubUrl("https://www.myvibe.so");
    expect(result).toBeInstanceOf(URL);
    expect(result.protocol).toBe("https:");
  });

  it("accepts localhost http for development", () => {
    const result = validateHubUrl("http://localhost:3000");
    expect(result.hostname).toBe("localhost");
  });

  it("accepts 127.0.0.1 http for development", () => {
    const result = validateHubUrl("http://127.0.0.1:8080");
    expect(result.hostname).toBe("127.0.0.1");
  });

  it("rejects http on non-localhost", () => {
    expect(() => validateHubUrl("http://example.com")).toThrow("must use HTTPS");
  });

  it("rejects ftp protocol", () => {
    expect(() => validateHubUrl("ftp://example.com")).toThrow("must use HTTPS");
  });

  it("rejects file protocol", () => {
    expect(() => validateHubUrl("file:///etc/passwd")).toThrow("must use HTTPS");
  });

  it("rejects invalid URL string", () => {
    expect(() => validateHubUrl("not-a-url")).toThrow("Invalid hub URL");
  });
});

describe("validateFilePath", () => {
  it("accepts relative path within cwd", () => {
    const result = validateFilePath("./dist");
    expect(result).toContain("dist");
  });

  it("rejects path traversal outside cwd", () => {
    expect(() => validateFilePath("../../../etc/passwd")).toThrow(
      "must be within current working directory"
    );
  });

  it("rejects absolute path outside cwd", () => {
    expect(() => validateFilePath("/etc/passwd")).toThrow(
      "must be within current working directory"
    );
  });
});

describe("validateFileSize", () => {
  it("accepts file within default limit", () => {
    expect(() => validateFileSize(100 * 1024 * 1024)).not.toThrow();
  });

  it("rejects file exceeding default limit", () => {
    expect(() => validateFileSize(600 * 1024 * 1024)).toThrow("File too large");
  });

  it("accepts custom limit", () => {
    expect(() => validateFileSize(50, 100)).not.toThrow();
  });

  it("rejects file exceeding custom limit", () => {
    expect(() => validateFileSize(150, 100)).toThrow("File too large");
  });

  it("exports MAX_UPLOAD_SIZE as 500MB", () => {
    expect(MAX_UPLOAD_SIZE).toBe(500 * 1024 * 1024);
  });
});

describe("validateVisibility", () => {
  it("accepts 'public'", () => {
    expect(() => validateVisibility("public")).not.toThrow();
  });

  it("accepts 'private'", () => {
    expect(() => validateVisibility("private")).not.toThrow();
  });

  it("rejects 'unlisted'", () => {
    expect(() => validateVisibility("unlisted")).toThrow("Invalid visibility");
  });

  it("rejects empty string", () => {
    expect(() => validateVisibility("")).toThrow("Invalid visibility");
  });
});

describe("validateToken", () => {
  it("accepts valid token", () => {
    expect(() => validateToken("blocklet-abc123def456")).not.toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validateToken("")).toThrow("non-empty string");
  });

  it("rejects null", () => {
    expect(() => validateToken(null)).toThrow("non-empty string");
  });

  it("rejects token shorter than 10 chars", () => {
    expect(() => validateToken("short")).toThrow("between 10 and 1024");
  });

  it("rejects token longer than 1024 chars", () => {
    expect(() => validateToken("a".repeat(1025))).toThrow("between 10 and 1024");
  });

  it("rejects non-string type", () => {
    expect(() => validateToken(12345678901)).toThrow("non-empty string");
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd skills/myvibe-publish/scripts && npx vitest run
```
Expected: FAIL — functions not exported from `constants.mjs`.

**Step 3: Add validation functions to constants.mjs**

Add to the end of `skills/myvibe-publish/scripts/utils/constants.mjs` (before `getScreenshotResultPath`), and add `import { join } from "node:path"` and `import { tmpdir } from "node:os"` to existing imports:

```javascript
// --- Validation ---

// Maximum upload file size: 500MB
export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

// SSE connection timeout: 5 minutes
export const SSE_TIMEOUT = 5 * 60 * 1000;

/**
 * Validate hub URL - must use HTTPS (localhost http allowed for dev)
 * @param {string} hubUrl - The hub URL to validate
 * @returns {URL} - Parsed URL object
 */
export function validateHubUrl(hubUrl) {
  let parsed;
  try {
    parsed = new URL(hubUrl);
  } catch {
    throw new Error(`Invalid hub URL: ${hubUrl}`);
  }
  const isLocalhost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocalhost && parsed.protocol === "http:")) {
    throw new Error(`Hub URL must use HTTPS: ${hubUrl}`);
  }
  return parsed;
}

/**
 * Validate file path - must be within current working directory
 * @param {string} filePath - The file path to validate
 * @returns {string} - Resolved absolute path
 */
export function validateFilePath(filePath) {
  const resolved = resolve(filePath);
  const cwd = process.cwd();
  if (!resolved.startsWith(cwd)) {
    throw new Error(`Path must be within current working directory: ${filePath}`);
  }
  return resolved;
}

/**
 * Validate file size against maximum limit
 * @param {number} fileSize - File size in bytes
 * @param {number} [maxSize] - Maximum allowed size in bytes
 */
export function validateFileSize(fileSize, maxSize = MAX_UPLOAD_SIZE) {
  if (fileSize > maxSize) {
    throw new Error(
      `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(0)}MB`
    );
  }
}

/**
 * Validate visibility value
 * @param {string} visibility - Visibility value
 */
export function validateVisibility(visibility) {
  const allowed = ["public", "private"];
  if (!allowed.includes(visibility)) {
    throw new Error(
      `Invalid visibility: "${visibility}". Must be one of: ${allowed.join(", ")}`
    );
  }
}

/**
 * Validate token format
 * @param {string} token - Access token
 */
export function validateToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token must be a non-empty string");
  }
  if (token.length < 10 || token.length > 1024) {
    throw new Error("Token length must be between 10 and 1024 characters");
  }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd skills/myvibe-publish/scripts && npx vitest run
```
Expected: All 20 tests PASS.

**Step 5: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/constants.mjs skills/myvibe-publish/scripts/utils/__tests__/validation.test.mjs
git commit -m "feat: add input validation functions with tests"
```

---

### Task 3: Fix tmpdir and add import

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/constants.mjs`

**Step 1: Update imports**

At the top of `constants.mjs`, add to existing imports:

```javascript
import { join } from "node:path";
import { tmpdir } from "node:os";
```

Note: `resolve` is already imported from `"node:path"`. Change that import line to:
```javascript
import { join, resolve } from "node:path";
```

**Step 2: Fix getScreenshotResultPath**

Replace line 79 in `constants.mjs`:
```javascript
  return `/tmp/myvibe-screenshot-${hash}.json`;
```
With:
```javascript
  return join(tmpdir(), `myvibe-screenshot-${hash}.json`);
```

**Step 3: Verify tests still pass**

Run:
```bash
cd skills/myvibe-publish/scripts && npx vitest run
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/constants.mjs
git commit -m "fix: use os.tmpdir() instead of hardcoded /tmp"
```

---

### Task 4: Integrate validation into publish.mjs

**Files:**
- Modify: `skills/myvibe-publish/scripts/publish.mjs`

**Step 1: Add imports**

At line 10 in `publish.mjs`, change:
```javascript
import { VIBE_HUB_URL_DEFAULT, API_PATHS, getScreenshotResultPath, isMainModule } from "./utils/constants.mjs";
```
To:
```javascript
import { VIBE_HUB_URL_DEFAULT, API_PATHS, getScreenshotResultPath, isMainModule, validateHubUrl, validateVisibility, validateFilePath } from "./utils/constants.mjs";
```

**Step 2: Add validation calls**

In the `publish()` function, after line 98 (`}` closing the `if (!skipUpload)` block) and before line 100 (`console.log`), insert:

```javascript
    // Validate inputs
    validateHubUrl(hub);
    validateVisibility(visibility);
```

In the dir branch, after line 158 (`throw new Error("Directory not found...")`), before line 161 (`const dirStat`), insert:
```javascript
        validateFilePath(dir);
```

In the file branch, after line 172 (`throw new Error("File not found...")`), before line 176 (`const fileInfo`), insert:
```javascript
        validateFilePath(file);
```

**Step 3: Verify the script still loads**

Run:
```bash
cd skills/myvibe-publish/scripts && node -e "import('./publish.mjs').then(() => console.log('OK'))"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/publish.mjs
git commit -m "feat: add input validation to publish workflow"
```

---

### Task 5: Integrate validation into save-token.mjs

**Files:**
- Modify: `skills/myvibe-publish/scripts/save-token.mjs`

**Step 1: Add imports and validation**

After line 17 (`}`) and before line 19 (`// Reuse existing store logic`), insert:

```javascript
const { validateToken, validateHubUrl } = await import("./utils/constants.mjs");
validateToken(values.token);
validateHubUrl(values.hub);
```

**Step 2: Verify the script still loads**

Run:
```bash
cd skills/myvibe-publish/scripts && node save-token.mjs --token "blocklet-test123456" --hub "https://www.myvibe.so" 2>&1 || true
```
Expected: Either saves successfully or fails on store access — not a validation error.

**Step 3: Commit**

```bash
git add skills/myvibe-publish/scripts/save-token.mjs
git commit -m "feat: add token and hub URL validation to save-token"
```

---

### Task 6: Integrate file size validation into upload.mjs

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/upload.mjs`

**Step 1: Add import**

At line 8 in `upload.mjs`, change:
```javascript
import { API_PATHS } from "./constants.mjs";
```
To:
```javascript
import { API_PATHS, validateFileSize } from "./constants.mjs";
```

**Step 2: Add validation call**

In the `uploadFile()` function, after line 34 (`const fileSize = fileStat.size;`), insert:

```javascript
  validateFileSize(fileSize);
```

**Step 3: Verify the script still loads**

Run:
```bash
cd skills/myvibe-publish/scripts && node -e "import('./utils/upload.mjs').then(() => console.log('OK'))"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/upload.mjs
git commit -m "feat: add file size validation to upload"
```

---

### Task 7: Add SSE timeout to http.mjs

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/http.mjs`

**Step 1: Add import**

At the top of `http.mjs`, after line 2 (`import { handleAuthError } from "./auth.mjs";`), add:

```javascript
import { SSE_TIMEOUT } from "./constants.mjs";
```

**Step 2: Add AbortController to subscribeToSSE**

In `subscribeToSSE()` function, replace lines 102-110:

```javascript
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
```

With:

```javascript
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSE_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
```

Then, change the catch block at lines 173-176 from:

```javascript
  } catch (error) {
    onError?.(error.message || error);
    throw error;
  }
```

To:

```javascript
  } catch (error) {
    if (error.name === "AbortError") {
      const msg = "SSE connection timed out";
      onError?.(msg);
      throw new Error(msg);
    }
    onError?.(error.message || error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
```

**Step 3: Verify the script still loads**

Run:
```bash
cd skills/myvibe-publish/scripts && node -e "import('./utils/http.mjs').then(() => console.log('OK'))"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add skills/myvibe-publish/scripts/utils/http.mjs
git commit -m "feat: add timeout protection to SSE connection"
```

---

### Task 8: Final verification

**Step 1: Run all tests**

Run:
```bash
cd skills/myvibe-publish/scripts && npx vitest run
```
Expected: All tests PASS.

**Step 2: Verify all scripts load without error**

Run:
```bash
cd skills/myvibe-publish/scripts && node -e "
  Promise.all([
    import('./publish.mjs'),
    import('./utils/upload.mjs'),
    import('./utils/http.mjs'),
    import('./utils/constants.mjs'),
  ]).then(() => console.log('All modules OK'))
"
```
Expected: `All modules OK`

**Step 3: Review all changes**

Run:
```bash
git diff main --stat
```

Expected files changed:
- `skills/myvibe-publish/scripts/package.json` (test scripts + devDeps)
- `skills/myvibe-publish/scripts/package-lock.json` (vitest)
- `skills/myvibe-publish/scripts/utils/constants.mjs` (validation functions + tmpdir fix)
- `skills/myvibe-publish/scripts/utils/__tests__/validation.test.mjs` (new test file)
- `skills/myvibe-publish/scripts/publish.mjs` (validation calls)
- `skills/myvibe-publish/scripts/save-token.mjs` (validation calls)
- `skills/myvibe-publish/scripts/utils/upload.mjs` (file size validation)
- `skills/myvibe-publish/scripts/utils/http.mjs` (SSE timeout)
- `docs/plans/` (design + plan docs)
