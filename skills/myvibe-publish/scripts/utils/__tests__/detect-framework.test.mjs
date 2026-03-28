import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { detectProjectType } from '../detect-framework.mjs'
import { inspectAndDetectProjectType, inspectProjectDirectory } from '../project-inspection.mjs'

const basePackageJson = {
  scripts: {},
  dependencies: {},
  devDependencies: {},
}

const cases = [
  {
    name: 'detects Vite from vite.config.ts',
    fixture: {
      files: ['vite.config.ts'],
      directories: [],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'vite',
      evidence: ['vite.config.ts'],
      likelyOutputs: ['dist'],
    },
  },
  {
    name: 'detects Vite from dependency plus build script with a root index.html entrypoint',
    fixture: {
      files: ['index.html', 'src/main.ts'],
      directories: ['src'],
      packageJson: {
        ...basePackageJson,
        scripts: { build: 'vite build' },
        devDependencies: { vite: '^6.0.0' },
      },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'vite',
      evidence: ['dependency:vite', 'script:build', 'file:index.html'],
      likelyOutputs: ['dist'],
    },
  },
  {
    name: 'detects Next.js from next.config.*',
    fixture: {
      files: ['next.config.mjs'],
      directories: [],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'nextjs',
      evidence: ['next.config.mjs'],
      likelyOutputs: ['out'],
    },
  },
  {
    name: 'uses .next as supporting Next.js evidence but not publishable pre-built output',
    fixture: {
      files: [],
      directories: ['.next'],
      packageJson: {
        ...basePackageJson,
        dependencies: { next: '^15.0.0' },
      },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'nextjs',
      evidence: ['dependency:next', 'directory:.next'],
      likelyOutputs: ['out'],
    },
  },
  {
    name: 'detects Astro from astro.config.*',
    fixture: {
      files: ['astro.config.ts'],
      directories: [],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'astro',
      evidence: ['astro.config.ts'],
      likelyOutputs: ['dist'],
    },
  },
  {
    name: 'detects Nuxt from nuxt.config.*',
    fixture: {
      files: ['nuxt.config.ts'],
      directories: [],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'nuxt',
      evidence: ['nuxt.config.ts'],
      likelyOutputs: ['.output/public'],
    },
  },
  {
    name: 'treats Nuxt as pre-built only when a static output directory contains index.html',
    fixture: {
      files: ['.output/public/index.html'],
      directories: ['.output', '.output/public'],
      packageJson: {
        ...basePackageJson,
        dependencies: { nuxt: '^3.0.0' },
      },
    },
    expected: {
      projectClass: 'pre-built',
      framework: 'nuxt',
      evidence: ['dependency:nuxt', 'file:.output/public/index.html'],
      likelyOutputs: ['.output/public'],
    },
  },
  {
    name: 'falls back to unknown-buildable when only a build script is present',
    fixture: {
      files: ['scripts/build.mjs'],
      directories: ['scripts'],
      packageJson: {
        ...basePackageJson,
        scripts: { build: 'node scripts/build.mjs' },
      },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'unknown-buildable',
      evidence: ['script:build'],
      likelyOutputs: [],
    },
  },
  {
    name: 'keeps a static project static',
    fixture: {
      files: ['index.html'],
      directories: [],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'static',
      framework: null,
      evidence: ['file:index.html'],
      likelyOutputs: [],
    },
  },
  {
    name: 'treats a static output directory with index.html as pre-built',
    fixture: {
      files: ['build-output/index.html'],
      directories: ['build-output'],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'pre-built',
      framework: null,
      evidence: ['file:build-output/index.html'],
      likelyOutputs: [],
    },
  },
  {
    name: 'does not treat public/index.html as generic pre-built output',
    fixture: {
      files: ['public/index.html'],
      directories: ['public'],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'unknown',
      framework: null,
      evidence: [],
      likelyOutputs: [],
    },
  },
  {
    name: 'does not treat nested package.json files as monorepo without workspace signals',
    fixture: {
      files: ['examples/demo/package.json', 'vite.config.ts'],
      directories: ['examples', 'examples/demo'],
      packageJson: { ...basePackageJson },
    },
    expected: {
      projectClass: 'buildable',
      framework: 'vite',
      evidence: ['vite.config.ts'],
      likelyOutputs: ['dist'],
    },
  },
  {
    name: 'keeps the outer level as monorepo',
    fixture: {
      files: ['packages/app/package.json', 'packages/site/package.json'],
      directories: ['packages', 'packages/app', 'packages/site'],
      packageJson: {
        ...basePackageJson,
        workspaces: ['packages/*'],
      },
    },
    expected: {
      projectClass: 'monorepo',
      framework: null,
      evidence: ['workspace'],
      likelyOutputs: [],
    },
  },
]

describe('detectProjectType', () => {
  for (const { name, fixture, expected } of cases) {
    it(name, () => {
      const result = detectProjectType(fixture)
      expect(result).toStrictEqual(expected)
    })
  }
})

async function createProjectFixture(structure) {
  const rootDir = await mkdtemp(join(tmpdir(), 'myvibe-detect-framework-'))

  for (const [relativePath, contents] of Object.entries(structure)) {
    const targetPath = join(rootDir, relativePath)
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, contents)
  }

  return rootDir
}

describe('inspectProjectDirectory', () => {
  it('collects the root package metadata and filesystem signals needed by the detector', async () => {
    const projectDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'demo',
        scripts: { build: 'vite build' },
        devDependencies: { vite: '^6.0.0' },
      }),
      'vite.config.ts': 'export default {}',
      'src/main.ts': 'console.log("hi")',
    })

    try {
      const project = await inspectProjectDirectory(projectDir)
      expect(project).toStrictEqual({
        files: ['vite.config.ts'],
        directories: [],
        packageJson: {
          scripts: { build: 'vite build' },
          dependencies: {},
          devDependencies: { vite: '^6.0.0' },
        },
        hasWorkspaceConfig: false,
        packageJsonCount: 1,
      })
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})

describe('inspectAndDetectProjectType', () => {
  it('refines a selected single-app Vite project to the Vite framework', async () => {
    const projectDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'demo',
        scripts: { build: 'vite build' },
        devDependencies: { vite: '^6.0.0' },
      }),
      'index.html': '<!doctype html>',
    })

    try {
      await expect(inspectAndDetectProjectType(projectDir)).resolves.toStrictEqual({
        projectClass: 'buildable',
        framework: 'vite',
        evidence: ['dependency:vite', 'script:build', 'file:index.html'],
        likelyOutputs: ['dist'],
      })
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('refines a selected single-app Next.js project to the Next.js framework', async () => {
    const projectDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: { next: '^15.0.0' },
      }),
      'next.config.mjs': 'export default {}',
      '.next/BUILD_ID': 'build-id',
    })

    try {
      await expect(inspectAndDetectProjectType(projectDir)).resolves.toStrictEqual({
        projectClass: 'buildable',
        framework: 'nextjs',
        evidence: ['next.config.mjs'],
        likelyOutputs: ['out'],
      })
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('keeps the monorepo outer level as monorepo', async () => {
    const projectDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        workspaces: ['apps/*'],
      }),
      'apps/web/package.json': JSON.stringify({
        name: 'web',
        scripts: { build: 'vite build' },
        devDependencies: { vite: '^6.0.0' },
      }),
      'apps/docs/package.json': JSON.stringify({
        name: 'docs',
        dependencies: { next: '^15.0.0' },
      }),
    })

    try {
      await expect(inspectAndDetectProjectType(projectDir)).resolves.toStrictEqual({
        projectClass: 'monorepo',
        framework: null,
        evidence: ['workspace'],
        likelyOutputs: [],
      })
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('can re-evaluate a selected monorepo app through the same helper after selection', async () => {
    const projectDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        workspaces: ['apps/*'],
      }),
      'apps/web/package.json': JSON.stringify({
        name: 'web',
        scripts: { build: 'vite build' },
        devDependencies: { vite: '^6.0.0' },
      }),
      'apps/web/vite.config.ts': 'export default {}',
    })

    try {
      await expect(inspectAndDetectProjectType(join(projectDir, 'apps/web'))).resolves.toStrictEqual({
        projectClass: 'buildable',
        framework: 'vite',
        evidence: ['vite.config.ts'],
        likelyOutputs: ['dist'],
      })
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('preserves non-target flows for static, pre-built, and unknown buildable projects', async () => {
    const staticDir = await createProjectFixture({
      'index.html': '<!doctype html>',
    })
    const preBuiltDir = await createProjectFixture({
      'build-output/index.html': '<!doctype html>',
    })
    const unknownBuildableDir = await createProjectFixture({
      'package.json': JSON.stringify({
        name: 'custom-build',
        scripts: { build: 'node scripts/build.mjs' },
      }),
    })

    try {
      await expect(inspectAndDetectProjectType(staticDir)).resolves.toStrictEqual({
        projectClass: 'static',
        framework: null,
        evidence: ['file:index.html'],
        likelyOutputs: [],
      })
      await expect(inspectAndDetectProjectType(preBuiltDir)).resolves.toStrictEqual({
        projectClass: 'pre-built',
        framework: null,
        evidence: ['file:build-output/index.html'],
        likelyOutputs: [],
      })
      await expect(inspectAndDetectProjectType(unknownBuildableDir)).resolves.toStrictEqual({
        projectClass: 'buildable',
        framework: 'unknown-buildable',
        evidence: ['script:build'],
        likelyOutputs: [],
      })
    } finally {
      await Promise.all([
        rm(staticDir, { recursive: true, force: true }),
        rm(preBuiltDir, { recursive: true, force: true }),
        rm(unknownBuildableDir, { recursive: true, force: true }),
      ])
    }
  })
})
