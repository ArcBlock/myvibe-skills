/**
 * Default shouldRetry: retry network errors and 5xx, not 4xx
 */
function defaultShouldRetry(error) {
  if (error.status && error.status >= 400 && error.status < 500) return false
  return true
}

/**
 * Retry a function with exponential backoff and jitter
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in ms
 * @param {Function} [options.shouldRetry] - Predicate to decide if error is retryable
 * @param {Function} [options.onRetry] - Callback on each retry (attempt, error)
 * @returns {Promise<*>} - Result of fn
 */
export async function retry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, shouldRetry = defaultShouldRetry, onRetry } = options

  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error
      }

      onRetry?.(attempt + 1, error)

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
