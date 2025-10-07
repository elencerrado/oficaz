/**
 * Retry utility for database operations during high-load scenarios
 * Helps handle connection timeouts and temporary failures during peak traffic (1000+ simultaneous users)
 */

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoff?: boolean;
}

/**
 * Executes an async function with retry logic
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 100,
    backoff = true
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain types of errors (business logic errors)
      if (error.message?.includes('Already clocked in') || 
          error.message?.includes('Not authorized') ||
          error.message?.includes('Invalid')) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff if enabled
      const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Database-specific retry wrapper with optimized settings for PostgreSQL
 */
export async function withDatabaseRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,      // Retry up to 3 times
    delayMs: 50,        // Start with 50ms delay
    backoff: true       // Use exponential backoff (50ms, 100ms, 200ms)
  });
}
