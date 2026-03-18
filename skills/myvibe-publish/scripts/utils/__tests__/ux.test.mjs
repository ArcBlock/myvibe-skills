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
    vi.resetModules()
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
