import { readdir, readFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'

import { detectProjectType, normalizePackageJson } from './detect-framework.mjs'

const ROOT_CONFIG_FILES = new Set([
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'next.config.cjs',
  'astro.config.js',
  'astro.config.mjs',
  'astro.config.ts',
  'astro.config.cjs',
  'nuxt.config.js',
  'nuxt.config.mjs',
  'nuxt.config.ts',
  'nuxt.config.cjs',
  'index.html',
])

const TRACKED_DIRECTORIES = new Set(['.next'])
const TRACKED_OUTPUT_INDEX_FILES = new Set([
  'dist/index.html',
  'build/index.html',
  'out/index.html',
  'build-output/index.html',
  '.output/public/index.html',
])
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules'])

function toPosixPath(value) {
  return value.split('\\').join('/')
}

async function readPackageJson(packageJsonPath) {
  try {
    const content = await readFile(packageJsonPath, 'utf8')
    return normalizePackageJson(JSON.parse(content))
  } catch {
    return normalizePackageJson({})
  }
}

async function collectProjectSignals(rootDir) {
  const files = new Set()
  const directories = new Set()
  let packageJsonCount = 0

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }

      const fullPath = join(currentDir, entry.name)
      const relativePath = toPosixPath(relative(rootDir, fullPath))

      if (entry.isDirectory()) {
        if (TRACKED_DIRECTORIES.has(relativePath)) {
          directories.add(relativePath)
        }

        await walk(fullPath)
        continue
      }

      if (entry.name === 'package.json') {
        packageJsonCount += 1
      }

      if (ROOT_CONFIG_FILES.has(relativePath) || TRACKED_OUTPUT_INDEX_FILES.has(relativePath)) {
        files.add(relativePath)
      }
    }
  }

  await walk(rootDir)

  return {
    files: [...files].sort(),
    directories: [...directories].sort(),
    packageJsonCount,
  }
}

export async function inspectProjectDirectory(projectDir) {
  const rootDir = resolve(projectDir)
  const packageJsonPath = join(rootDir, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)
  const projectSignals = await collectProjectSignals(rootDir)

  return {
    ...projectSignals,
    packageJson,
    hasWorkspaceConfig: Object.prototype.hasOwnProperty.call(packageJson, 'workspaces'),
  }
}

export async function inspectAndDetectProjectType(projectDir) {
  const project = await inspectProjectDirectory(projectDir)
  return detectProjectType(project)
}
