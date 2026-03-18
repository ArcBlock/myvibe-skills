#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { createUx } from './ux.mjs'
import { ERROR_CODES, getErrorHint, isMainModule } from './constants.mjs'

/**
 * Parse and validate a Git repository URL
 * @param {string} url - Repository URL (HTTPS or SSH)
 * @returns {{ valid: boolean, protocol?: string, url?: string, error?: string }}
 */
export function parseRepoUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Repository URL is required' }
  }

  const trimmed = url.trim()

  // SSH format: git@host:user/repo.git
  if (/^git@[\w.-]+:[\w./-]+$/.test(trimmed)) {
    return { valid: true, protocol: 'ssh', url: trimmed }
  }

  // HTTPS format
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return { valid: true, protocol: 'https', url: trimmed }
    }
  } catch {
    // Not a valid URL
  }

  return { valid: false, error: `Invalid repository URL: ${trimmed}` }
}

/**
 * Inject token into HTTPS URL for private repo access
 * @param {string} url - Repository URL
 * @param {string|undefined} token - Git access token
 * @returns {string} - URL with token injected (or unchanged)
 */
export function injectToken(url, token) {
  if (!token || !url.startsWith('https://')) {
    return url
  }

  const parsed = new URL(url)
  parsed.username = token
  return parsed.toString()
}

/**
 * Build git clone command arguments
 * @param {string} url - Repository URL (with token if needed)
 * @param {string} dest - Destination directory
 * @param {string|undefined} branch - Branch, tag, or ref
 * @returns {string[]} - Git command arguments
 */
export function buildCloneArgs(url, dest, branch) {
  const args = ['clone', '--depth', '1']
  if (branch) {
    args.push('--branch', branch)
  }
  args.push(url, dest)
  return args
}

/**
 * Execute git command
 * @param {string[]} args - Git command arguments
 * @returns {Promise<{ success: boolean, stderr?: string }>}
 */
function execGit(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { timeout: 120000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve({ success: true, stderr })
      }
    })
  })
}

/**
 * Clone a git repository to a temporary directory
 * @param {Object} options
 * @param {string} options.repo - Repository URL
 * @param {string} [options.branch] - Branch, tag, or commit
 * @param {string} [options.path] - Subdirectory within repo
 * @param {string} [options.gitToken] - Token for HTTPS auth
 * @returns {Promise<{ success: boolean, clonePath: string, repoRoot: string, cleanup: Function }>}
 */
export async function cloneRepo(options) {
  const { repo, branch, path: subdir, gitToken } = options
  const ux = createUx()

  const parsed = parseRepoUrl(repo)
  if (!parsed.valid) {
    const error = new Error(parsed.error)
    error.errorCode = ERROR_CODES.INVALID_REPO_URL
    throw error
  }

  try {
    await execGit(['--version'])
  } catch {
    const error = new Error('Git is not installed')
    error.errorCode = ERROR_CODES.GIT_NOT_FOUND
    throw error
  }

  const cloneUrl = injectToken(parsed.url, gitToken)
  const suffix = randomBytes(4).toString('hex')
  const cloneDest = `/tmp/myvibe-repo-${suffix}`

  ux.step(`Cloning ${repo}${branch ? ` (${branch})` : ''}...`)
  const cloneArgs = buildCloneArgs(cloneUrl, cloneDest, branch)

  try {
    await execGit(cloneArgs)
  } catch (err) {
    const message = err.message || ''
    if (
      message.includes('Authentication') ||
      message.includes('could not read Username') ||
      message.includes('Permission denied')
    ) {
      const error = new Error(`Authentication failed for ${repo}`)
      error.errorCode = ERROR_CODES.GIT_AUTH_FAILED
      throw error
    }
    const error = new Error(`Clone failed: ${message}`)
    error.errorCode = ERROR_CODES.GIT_CLONE_FAILED
    throw error
  }

  let finalPath = cloneDest
  if (subdir) {
    finalPath = join(cloneDest, subdir)
    if (!existsSync(finalPath)) {
      await rm(cloneDest, { recursive: true, force: true })
      const error = new Error(`Subdirectory not found: ${subdir}`)
      error.errorCode = ERROR_CODES.SUBDIR_NOT_FOUND
      throw error
    }
  }

  ux.success(`Repository cloned to ${finalPath}`)

  const cleanup = async () => {
    try {
      await rm(cloneDest, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  return {
    success: true,
    clonePath: finalPath,
    repoRoot: cloneDest,
    cleanup,
  }
}

// CLI entry point
if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2)
  const options = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--repo':
      case '-r':
        options.repo = args[++i]
        break
      case '--branch':
      case '-b':
        options.branch = args[++i]
        break
      case '--path':
      case '-p':
        options.path = args[++i]
        break
      case '--git-token':
        options.gitToken = args[++i]
        break
    }
  }

  try {
    const result = await cloneRepo(options)
    const output = JSON.stringify({
      success: true,
      clonePath: result.clonePath,
      repoRoot: result.repoRoot,
    })
    process.stdout.write(output + '\n')
  } catch (error) {
    const ux = createUx()
    const code = error.errorCode || ERROR_CODES.GIT_CLONE_FAILED
    ux.error(code, error.message, getErrorHint(code))
    process.exit(1)
  }
}
