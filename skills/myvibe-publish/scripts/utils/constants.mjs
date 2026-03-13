// MyVibe publish constants

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Default MyVibe URL
export const VIBE_HUB_URL_DEFAULT = "https://www.myvibe.so";

// MyVibe blocklet DID (used to resolve mount path via __blocklet__.js)
export const MYVIBE_BLOCKLET_DID = "z2qa3cy63otaA2A7zHADRichVkSGVyevtYhYQ";

// API endpoints
export const API_PATHS = {
  // Upload file (HTML or ZIP)
  UPLOAD: "/api/uploaded-blocklets/upload",
  // Convert uploaded blocklet
  CONVERT: (did) => `/api/uploaded-blocklets/${did}/convert`,
  // Conversion stream (SSE)
  CONVERT_STREAM: (did) => `/api/uploaded-blocklets/${did}/convert/stream`,
  // Conversion status
  CONVERSION_STATUS: (did) => `/api/uploaded-blocklets/${did}/conversion-status`,
  // Vibe action (publish/draft/abandon)
  VIBE_ACTION: (did) => `/api/vibes/${did}/action`,
  // Get vibe info
  VIBE_INFO: (did) => `/api/vibes/${did}`,
  // Create vibe from URL
  VIBES_FROM_URL: "/api/vibes/from-url",
};

// Well-known service path for authorization
export const WELLKNOWN_SERVICE_PATH = "/.well-known/service";

// Authorization timeout (5 minutes)
export const AUTH_TIMEOUT_MINUTES = 5;
export const AUTH_FETCH_INTERVAL = 3000; // 3 seconds
export const AUTH_RETRY_COUNT = (AUTH_TIMEOUT_MINUTES * 60 * 1000) / AUTH_FETCH_INTERVAL;

// Supported file types
export const SUPPORTED_ARCHIVE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
];

export const SUPPORTED_HTML_TYPES = ["text/html"];

// File extensions
export const ARCHIVE_EXTENSIONS = [".zip"];
export const HTML_EXTENSIONS = [".html", ".htm"];

// Screenshot result file path (shared between generate-screenshot.mjs and publish.mjs)
// Uses hash of source path to avoid conflicts in concurrent publishes

/**
 * Get screenshot result file path based on source path
 * @param {string} sourcePath - The source path (dir or file) being published
 * @returns {string} - Path to screenshot result file: /tmp/myvibe-screenshot-{hash}.json
 */
/**
 * Check if the current module is the main entry point.
 * Handles symlinks by comparing real paths.
 * @param {string} metaUrl - import.meta.url of the calling module
 * @returns {boolean}
 */
export function isMainModule(metaUrl) {
  try {
    const scriptPath = fileURLToPath(metaUrl);
    const argvPath = resolve(process.argv[1]);
    return realpathSync(scriptPath) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

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

export function getScreenshotResultPath(sourcePath) {
  const absolutePath = resolve(sourcePath);
  const hash = createHash("md5").update(absolutePath).digest("hex").slice(0, 8);
  return join(tmpdir(), `myvibe-screenshot-${hash}.json`);
}
