const VITE_CONFIG_FILES = new Set(['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.cjs'])
const NEXT_CONFIG_FILES = new Set(['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs'])
const ASTRO_CONFIG_FILES = new Set(['astro.config.js', 'astro.config.mjs', 'astro.config.ts', 'astro.config.cjs'])
const NUXT_CONFIG_FILES = new Set(['nuxt.config.js', 'nuxt.config.mjs', 'nuxt.config.ts', 'nuxt.config.cjs'])
const STATIC_OUTPUT_DIRECTORIES = new Set(['dist', 'build', 'out', 'build-output'])

function hasFile(files, target) {
  return files.has(target)
}

function hasDirectory(directories, target) {
  return directories.has(target)
}

function hasDependency(packageJson, dependencyName) {
  return Boolean(packageJson.dependencies[dependencyName] || packageJson.devDependencies[dependencyName])
}

function hasBuildScript(packageJson) {
  return typeof packageJson.scripts.build === 'string' && packageJson.scripts.build.trim().length > 0
}

function hasWorkspaceSignal(project, packageJson) {
  return (
    project.hasWorkspaceConfig === true ||
    project.packageJsonCount > 1 ||
    Array.isArray(packageJson.workspaces) ||
    Object.prototype.hasOwnProperty.call(packageJson, 'workspaces')
  )
}

function getStaticOutputIndexFiles(files) {
  const matches = []

  for (const file of files) {
    if (!file.endsWith('/index.html')) {
      continue
    }

    const directory = file.slice(0, -'/index.html'.length)
    if (STATIC_OUTPUT_DIRECTORIES.has(directory) || directory === '.output/public') {
      matches.push(file)
    }
  }

  return matches
}

export function normalizePackageJson(pkg = {}) {
  const normalized = {
    scripts: pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {},
    dependencies: pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {},
    devDependencies: pkg.devDependencies && typeof pkg.devDependencies === 'object' ? pkg.devDependencies : {},
  }

  if (Object.prototype.hasOwnProperty.call(pkg, 'workspaces')) {
    normalized.workspaces = pkg.workspaces
  }

  return normalized
}

export function detectFrameworkEvidence(project = {}) {
  const files = new Set(Array.isArray(project.files) ? project.files : [])
  const directories = new Set(Array.isArray(project.directories) ? project.directories : [])
  const packageJson = normalizePackageJson(project.packageJson)
  const hasRootIndexHtml = hasFile(files, 'index.html')

  for (const configFile of NEXT_CONFIG_FILES) {
    if (hasFile(files, configFile)) {
      return { framework: 'nextjs', evidence: [configFile], likelyOutputs: ['out'] }
    }
  }

  if (hasDependency(packageJson, 'next')) {
    const evidence = ['dependency:next']
    if (hasDirectory(directories, '.next')) {
      evidence.push('directory:.next')
    }

    return { framework: 'nextjs', evidence, likelyOutputs: ['out'] }
  }

  for (const configFile of ASTRO_CONFIG_FILES) {
    if (hasFile(files, configFile)) {
      return { framework: 'astro', evidence: [configFile], likelyOutputs: ['dist'] }
    }
  }

  if (hasDependency(packageJson, 'astro')) {
    return { framework: 'astro', evidence: ['dependency:astro'], likelyOutputs: ['dist'] }
  }

  for (const configFile of NUXT_CONFIG_FILES) {
    if (hasFile(files, configFile)) {
      return { framework: 'nuxt', evidence: [configFile], likelyOutputs: ['.output/public'] }
    }
  }

  if (hasDependency(packageJson, 'nuxt')) {
    return { framework: 'nuxt', evidence: ['dependency:nuxt'], likelyOutputs: ['.output/public'] }
  }

  for (const configFile of VITE_CONFIG_FILES) {
    if (hasFile(files, configFile)) {
      return { framework: 'vite', evidence: [configFile], likelyOutputs: ['dist'] }
    }
  }

  if (hasDependency(packageJson, 'vite') && hasBuildScript(packageJson) && hasRootIndexHtml) {
    return {
      framework: 'vite',
      evidence: ['dependency:vite', 'script:build', 'file:index.html'],
      likelyOutputs: ['dist'],
    }
  }

  return null
}

export function detectProjectType(project = {}) {
  const files = new Set(Array.isArray(project.files) ? project.files : [])
  const packageJson = normalizePackageJson(project.packageJson)

  if (hasWorkspaceSignal(project, packageJson)) {
    return {
      projectClass: 'monorepo',
      framework: null,
      evidence: ['workspace'],
      likelyOutputs: [],
    }
  }

  const frameworkEvidence = detectFrameworkEvidence(project)
  const staticOutputIndexFiles = getStaticOutputIndexFiles(files)
  const staticOutputEvidence = staticOutputIndexFiles.map((file) => `file:${file}`)

  if (frameworkEvidence?.framework === 'nuxt' && staticOutputIndexFiles.length > 0) {
    return {
      projectClass: 'pre-built',
      framework: frameworkEvidence.framework,
      evidence: [...frameworkEvidence.evidence, ...staticOutputEvidence],
      likelyOutputs: [...frameworkEvidence.likelyOutputs],
    }
  }

  if (frameworkEvidence?.framework === 'nextjs' && staticOutputIndexFiles.some((file) => file.startsWith('out/'))) {
    return {
      projectClass: 'pre-built',
      framework: frameworkEvidence.framework,
      evidence: [...frameworkEvidence.evidence, ...staticOutputEvidence],
      likelyOutputs: [...frameworkEvidence.likelyOutputs],
    }
  }

  if (frameworkEvidence) {
    return {
      projectClass: 'buildable',
      framework: frameworkEvidence.framework,
      evidence: [...frameworkEvidence.evidence],
      likelyOutputs: [...frameworkEvidence.likelyOutputs],
    }
  }

  if (hasBuildScript(packageJson)) {
    return {
      projectClass: 'buildable',
      framework: 'unknown-buildable',
      evidence: ['script:build'],
      likelyOutputs: [],
    }
  }

  if (hasFile(files, 'index.html')) {
    return {
      projectClass: 'static',
      framework: null,
      evidence: ['file:index.html'],
      likelyOutputs: [],
    }
  }

  if (staticOutputIndexFiles.length > 0) {
    return {
      projectClass: 'pre-built',
      framework: null,
      evidence: [...staticOutputEvidence],
      likelyOutputs: [],
    }
  }

  return {
    projectClass: 'unknown',
    framework: null,
    evidence: [],
    likelyOutputs: [],
  }
}
