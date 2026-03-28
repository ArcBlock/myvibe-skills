import open from 'open'
import { joinURL } from 'ufo'
import { createConnect } from '@aigne/cli/utils/aigne-hub/credential.js'

import { createStore } from './store.mjs'
import { WELLKNOWN_SERVICE_PATH, AUTH_RETRY_COUNT, AUTH_FETCH_INTERVAL, ERROR_CODES } from './constants.mjs'
import { getApiBaseUrl } from './blocklet-info.mjs'
import { createUx } from './ux.mjs'

const TOKEN_KEY = 'MYVIBE_ACCESS_TOKEN'

/**
 * Get cached access token for a given hub URL
 * @param {string} hubUrl - The MyVibe URL
 * @returns {Promise<string|null>} - The cached access token or null
 */
export async function getCachedAccessToken(hubUrl) {
  const ux = createUx()
  const { hostname } = new URL(hubUrl)
  const store = await createStore()

  // Check environment variable first
  let accessToken = process.env.MYVIBE_ACCESS_TOKEN

  // Check stored token
  if (!accessToken) {
    try {
      const storeItem = await store.getItem(hostname)
      accessToken = storeItem?.[TOKEN_KEY]
    } catch (error) {
      ux.warn('Could not read stored token: ' + error.message)
    }
  }

  return accessToken || null
}

/**
 * Save access token for a given hub URL
 * @param {string} hubUrl - The MyVibe URL
 * @param {string} token - The access token to save
 */
async function saveAccessToken(hubUrl, token) {
  const ux = createUx()
  const { hostname } = new URL(hubUrl)
  const store = await createStore()

  try {
    await store.setItem(hostname, { [TOKEN_KEY]: token })
  } catch (error) {
    ux.warn('Could not save token: ' + error.message)
  }
}

/**
 * Clear access token for a given hub URL
 * @param {string} hubUrl - The MyVibe URL
 */
export async function clearAccessToken(hubUrl) {
  const ux = createUx()
  const { hostname } = new URL(hubUrl)
  const store = await createStore()

  try {
    await store.clearHost(hostname)
    ux.warn(`Cleared authorization for ${hostname}`)
  } catch (error) {
    ux.warn('Could not clear token: ' + error.message)
  }
}

/**
 * Get access token, prompting for authorization if needed
 * @param {string} hubUrl - The MyVibe URL
 * @param {string} [locale='en'] - User locale
 * @returns {Promise<string>} - The access token
 */
export async function getAccessToken(hubUrl, locale = 'en') {
  const ux = createUx()

  // Check for cached token first
  let accessToken = await getCachedAccessToken(hubUrl)
  if (accessToken) {
    return accessToken
  }

  // Need to get new token via authorization
  const apiBaseUrl = await getApiBaseUrl(hubUrl)
  const connectUrl = joinURL(apiBaseUrl, WELLKNOWN_SERVICE_PATH)

  ux.step('Authorization required for MyVibe...')

  try {
    const result = await createConnect({
      connectUrl,
      connectAction: 'gen-simple-access-key',
      source: 'MyVibe Publish Skill',
      closeOnSuccess: true,
      appName: 'MyVibe',
      appLogo: 'https://www.myvibe.so/image-bin/uploads/6c26b2b5226ed0d554ac0b4ea0b6db38.jpeg',
      retry: AUTH_RETRY_COUNT,
      fetchInterval: AUTH_FETCH_INTERVAL,
      openPage: async (pageUrl) => {
        const url = new URL(pageUrl)
        url.searchParams.set('locale', locale)
        const tipsTitleApp = getAgentName()
        if (tipsTitleApp) {
          url.searchParams.set('tipsTitleApp', tipsTitleApp)
        }

        const connectUrl = url.toString()
        open(connectUrl)

        ux.step('Please open the following URL in your browser to authorize:')
        ux.info(connectUrl)
      },
    })

    accessToken = result.accessKeySecret

    // Save token for future use
    await saveAccessToken(hubUrl, accessToken)

    ux.success('Authorization successful!')

    return accessToken
  } catch (error) {
    const err = new Error(
      'Authorization failed. Possible causes: network issue, timeout (5 minutes), or user cancelled.'
    )
    err.errorCode = ERROR_CODES.AUTH_FAILED
    err.cause = error
    throw err
  }
}

/**
 * Handle authorization error (401/403)
 * Clears the token so next request will re-authorize
 * @param {string} hubUrl - The MyVibe URL
 * @param {number} statusCode - HTTP status code
 */
export async function handleAuthError(hubUrl, statusCode) {
  const ux = createUx()
  if (statusCode === 401 || statusCode === 403) {
    ux.warn(`Authorization error (${statusCode}). Clearing saved token...`)
    await clearAccessToken(hubUrl)
    ux.step('Please run the publish command again to re-authorize.')
  }
}

function getAgentName() {
  if (process.env.CODEX) {
    return 'Codex'
  }
  if (process.env.CLAUDECODE) {
    return 'Claude Code'
  }
  if (process.env.GEMINI_CLI) {
    return 'Gemini CLI'
  }
  if (process.env.OPENCODE) {
    return 'OpenCode'
  }
}
