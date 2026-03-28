// MyVibe publish constants

import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Default MyVibe URL
export const VIBE_HUB_URL_DEFAULT = 'https://www.myvibe.so'

// MyVibe blocklet DID (used to resolve mount path via __blocklet__.js)
export const MYVIBE_BLOCKLET_DID = 'z2qa3cy63otaA2A7zHADRichVkSGVyevtYhYQ'

// API endpoints
export const API_PATHS = {
  // Upload file (HTML or ZIP)
  UPLOAD: '/api/uploaded-blocklets/upload',
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
  VIBES_FROM_URL: '/api/vibes/from-url',
}

// Well-known service path for authorization
export const WELLKNOWN_SERVICE_PATH = '/.well-known/service'

// Authorization timeout (5 minutes)
export const AUTH_TIMEOUT_MINUTES = 5
export const AUTH_FETCH_INTERVAL = 3000 // 3 seconds
export const AUTH_RETRY_COUNT = (AUTH_TIMEOUT_MINUTES * 60 * 1000) / AUTH_FETCH_INTERVAL

// Supported file types
export const SUPPORTED_ARCHIVE_TYPES = ['application/zip', 'application/x-zip-compressed']

export const SUPPORTED_HTML_TYPES = ['text/html']

// File extensions
export const ARCHIVE_EXTENSIONS = ['.zip']
export const HTML_EXTENSIONS = ['.html', '.htm']

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
    const scriptPath = fileURLToPath(metaUrl)
    const argvPath = resolve(process.argv[1])
    return realpathSync(scriptPath) === realpathSync(argvPath)
  } catch {
    return false
  }
}

export function getScreenshotResultPath(sourcePath) {
  const absolutePath = resolve(sourcePath)
  const hash = createHash('md5').update(absolutePath).digest('hex').slice(0, 8)
  return `/tmp/myvibe-screenshot-${hash}.json`
}

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
