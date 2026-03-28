import { describe, it, expect, vi } from 'vitest'
import { retry } from '../retry.mjs'

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok')
    const result = await retry(fn, { maxRetries: 3, baseDelay: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent fail'))
    await expect(retry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('persistent fail')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should not retry 4xx errors by default', async () => {
    const error = new Error('bad request')
    error.status = 400
    const fn = vi.fn().mockRejectedValue(error)
    await expect(retry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry 5xx errors', async () => {
    const error5xx = new Error('server error')
    error5xx.status = 500
    const fn = vi.fn().mockRejectedValueOnce(error5xx).mockResolvedValue('ok')
    const result = await retry(fn, { maxRetries: 3, baseDelay: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok')
    await retry(fn, { maxRetries: 3, baseDelay: 10, onRetry })
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  })

  it('should respect custom shouldRetry', async () => {
    const customError = new Error('custom')
    customError.retryable = false
    const fn = vi.fn().mockRejectedValue(customError)
    await expect(
      retry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        shouldRetry: (err) => err.retryable !== false,
      })
    ).rejects.toThrow('custom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
