import { stat } from 'node:fs/promises'
import { open as fsOpen } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import crypto from 'node:crypto'
import { joinURL } from 'ufo'

import { API_PATHS, ERROR_CODES } from './constants.mjs'
import { handleAuthError } from './auth.mjs'
import { getApiBaseUrl } from './blocklet-info.mjs'
import { createUx, formatBytes } from './ux.mjs'
import { retry } from './retry.mjs'

const CHUNK_SIZE = 256 * 1024 // 256KB

/**
 * Read a chunk of a file at a given offset
 */
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

/**
 * Upload a file to MyVibe using TUS protocol
 * @param {string} filePath - Path to the file to upload
 * @param {string} hubUrl - MyVibe URL
 * @param {string} accessToken - Access token
 * @param {Object} options - Upload options
 * @param {string} [options.did] - Existing Vibe DID for version update
 * @returns {Promise<{did: string, id: string, status: string}>} - Upload result
 */
export async function uploadFile(filePath, hubUrl, accessToken, options = {}) {
  const ux = createUx()
  const { did } = options
  const { origin } = new URL(hubUrl)
  const apiBaseUrl = await getApiBaseUrl(hubUrl)

  // Build upload endpoint with optional did query parameter
  let uploadEndpoint = joinURL(apiBaseUrl, API_PATHS.UPLOAD)
  if (did) {
    uploadEndpoint = `${uploadEndpoint}?did=${encodeURIComponent(did)}`
  }

  // Get file info
  const fileStat = await stat(filePath)
  const fileSize = fileStat.size
  const fileName = basename(filePath)
  const fileExt = extname(filePath).slice(1).toLowerCase()

  // Determine MIME type
  let mimeType = 'application/octet-stream'
  if (fileExt === 'zip') {
    mimeType = 'application/zip'
  } else if (fileExt === 'html' || fileExt === 'htm') {
    mimeType = 'text/html'
  }

  // Generate file ID
  const fileHash = crypto.randomBytes(16).toString('hex')
  const uploaderId = 'MyVibePublish'
  const fileId = `${uploaderId}-${fileHash}`

  ux.step(`Uploading: ${fileName} (${formatBytes(fileSize)})`)

  // Use random hash prefix to avoid filename collision
  const uniqueFileName = `${fileHash.slice(0, 8)}-${fileName}`

  // TUS metadata
  const tusMetadata = {
    uploaderId,
    relativePath: uniqueFileName,
    name: uniqueFileName,
    type: mimeType,
    filetype: mimeType,
    filename: uniqueFileName,
  }

  const encodedMetadata = Object.entries(tusMetadata)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString('base64')}`)
    .join(',')

  const endpointPath = new URL(uploadEndpoint).pathname

  // Step 1: Create upload (with retry)
  const createResponse = await retry(
    async () => {
      const resp = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': fileSize.toString(),
          'Upload-Metadata': encodedMetadata,
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
        },
      })

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          await handleAuthError(hubUrl, resp.status)
        }
        const errorText = await resp.text()
        const err = new Error(`Failed to create upload: ${resp.status} ${resp.statusText}\n${errorText}`)
        err.status = resp.status
        err.errorCode = ERROR_CODES.UPLOAD_FAILED
        throw err
      }
      return resp
    },
    {
      maxRetries: 3,
      onRetry: (attempt, error) => ux.warn(`Upload create retry ${attempt}/3: ${error.message}`),
    }
  )

  const uploadUrl = createResponse.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('No upload URL received from server')
  }
  ux.info(`Upload URL: ${uploadUrl}`)
  ux.info('Upload created, sending file data...')

  // Step 2: Upload file content in chunks with progress
  const fullUploadUrl = `${origin}${uploadUrl}`
  let offset = 0
  let lastResponse

  while (offset < fileSize) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize)
    const chunk = await readChunk(filePath, offset, chunkEnd - offset)

    lastResponse = await retry(
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
          err.errorCode = ERROR_CODES.UPLOAD_FAILED
          throw err
        }
        return resp
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

  let result
  try {
    result = await lastResponse.json()
  } catch {
    throw new Error('Invalid response from server after upload')
  }

  // Check for upload errors
  if (result.error) {
    const err = new Error(`Upload error: ${result.error.code || result.error.message || JSON.stringify(result.error)}`)
    err.errorCode = ERROR_CODES.UPLOAD_FAILED
    throw err
  }

  // Extract blocklet info from result
  const blocklet = result.blocklet
  if (!blocklet) {
    throw new Error('No blocklet info in upload response')
  }

  ux.success(`Upload complete! DID: ${blocklet.did}`)

  return {
    did: blocklet.did,
    id: blocklet.id,
    status: blocklet.status,
    isNewUpload: blocklet.isNewUpload,
    versionHistoryEnabled: blocklet.versionHistoryEnabled,
  }
}

/**
 * Create a vibe from URL
 * @param {string} url - URL to import
 * @param {string} hubUrl - MyVibe URL
 * @param {string} accessToken - Access token
 * @returns {Promise<{did: string, id: string}>}
 */
export async function createVibeFromUrl(url, hubUrl, accessToken) {
  const ux = createUx()
  const apiBaseUrl = await getApiBaseUrl(hubUrl)
  const apiUrl = joinURL(apiBaseUrl, API_PATHS.VIBES_FROM_URL)

  ux.step(`Importing URL: ${url}`)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
    }),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await handleAuthError(hubUrl, response.status)
    }
    let errorMessage
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorData.message || response.statusText
    } catch {
      errorMessage = response.statusText
    }
    const err = new Error(`Failed to create vibe from URL: ${errorMessage}`)
    err.errorCode = ERROR_CODES.UPLOAD_FAILED
    throw err
  }

  const result = await response.json()
  const blocklet = result.blocklet

  if (!blocklet || !blocklet.did) {
    throw new Error('No blocklet info in response')
  }

  ux.success(`Vibe created! DID: ${blocklet.did}`)

  return {
    did: blocklet.did,
    id: blocklet.id,
    status: blocklet.status,
  }
}
