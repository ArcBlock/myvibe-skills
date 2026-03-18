import { describe, it, expect } from 'vitest'
import { parseRepoUrl, injectToken, buildCloneArgs } from '../clone-repo.mjs'

describe('parseRepoUrl', () => {
  it('should accept HTTPS GitHub URL', () => {
    const result = parseRepoUrl('https://github.com/user/repo')
    expect(result).toEqual({ valid: true, protocol: 'https', url: 'https://github.com/user/repo' })
  })

  it('should accept HTTPS URL with .git suffix', () => {
    const result = parseRepoUrl('https://github.com/user/repo.git')
    expect(result).toEqual({ valid: true, protocol: 'https', url: 'https://github.com/user/repo.git' })
  })

  it('should accept SSH URL', () => {
    const result = parseRepoUrl('git@github.com:user/repo.git')
    expect(result).toEqual({ valid: true, protocol: 'ssh', url: 'git@github.com:user/repo.git' })
  })

  it('should reject invalid URL', () => {
    const result = parseRepoUrl('not-a-url')
    expect(result.valid).toBe(false)
  })

  it('should reject empty string', () => {
    const result = parseRepoUrl('')
    expect(result.valid).toBe(false)
  })
})

describe('injectToken', () => {
  it('should inject token into HTTPS URL', () => {
    const result = injectToken('https://github.com/user/repo.git', 'ghp_abc123')
    expect(result).toBe('https://ghp_abc123@github.com/user/repo.git')
  })

  it('should return SSH URL unchanged', () => {
    const result = injectToken('git@github.com:user/repo.git', 'ghp_abc123')
    expect(result).toBe('git@github.com:user/repo.git')
  })

  it('should return URL unchanged when no token', () => {
    const result = injectToken('https://github.com/user/repo.git', undefined)
    expect(result).toBe('https://github.com/user/repo.git')
  })
})

describe('buildCloneArgs', () => {
  it('should build basic clone args', () => {
    const args = buildCloneArgs('https://github.com/user/repo.git', '/tmp/dest')
    expect(args).toEqual(['clone', '--depth', '1', 'https://github.com/user/repo.git', '/tmp/dest'])
  })

  it('should include branch when specified', () => {
    const args = buildCloneArgs('https://github.com/user/repo.git', '/tmp/dest', 'v2.0')
    expect(args).toEqual(['clone', '--depth', '1', '--branch', 'v2.0', 'https://github.com/user/repo.git', '/tmp/dest'])
  })
})
