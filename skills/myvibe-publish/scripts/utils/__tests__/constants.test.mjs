import { describe, it, expect } from 'vitest'
import { ERROR_CODES, ERROR_HINTS, getErrorHint } from '../constants.mjs'

describe('error codes', () => {
  it('should export all expected error codes', () => {
    expect(ERROR_CODES.AUTH_REQUIRED).toBe('AUTH_REQUIRED')
    expect(ERROR_CODES.AUTH_EXPIRED).toBe('AUTH_EXPIRED')
    expect(ERROR_CODES.AUTH_FAILED).toBe('AUTH_FAILED')
    expect(ERROR_CODES.UPLOAD_FAILED).toBe('UPLOAD_FAILED')
    expect(ERROR_CODES.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND')
    expect(ERROR_CODES.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE')
    expect(ERROR_CODES.UNSUPPORTED_TYPE).toBe('UNSUPPORTED_TYPE')
    expect(ERROR_CODES.CONVERT_FAILED).toBe('CONVERT_FAILED')
    expect(ERROR_CODES.CONVERT_TIMEOUT).toBe('CONVERT_TIMEOUT')
    expect(ERROR_CODES.PUBLISH_FAILED).toBe('PUBLISH_FAILED')
    expect(ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR')
  })

  it('should have hints for key error codes', () => {
    expect(ERROR_HINTS[ERROR_CODES.AUTH_EXPIRED]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.UPLOAD_FAILED]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.CONVERT_TIMEOUT]).toBeDefined()
    expect(ERROR_HINTS[ERROR_CODES.FILE_TOO_LARGE]).toBeDefined()
  })

  it('getErrorHint should return hint for known code', () => {
    expect(getErrorHint('UPLOAD_FAILED')).toContain('network')
  })

  it('getErrorHint should return undefined for unknown code', () => {
    expect(getErrorHint('UNKNOWN_CODE')).toBeUndefined()
  })
})
