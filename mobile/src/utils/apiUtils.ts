/**
 * Core API Utilities
 * 
 * Centralized utility functions for handling API requests, error sanitization,
 * and retry logic (specifically to mitigate infrastructure issues like 
 * Cloudflare 525 SSL Handshake errors in certain regions).
 */

/**
 * Sanitizes HTML error responses from infrastructure issues (e.g., Cloudflare 525)
 * into user-friendly messages, preventing raw HTML from being logged or displayed.
 * 
 * @param errorMsg The raw error message string
 * @returns A clean, user-friendly error message
 */
export const sanitizeErrorMessage = (errorMsg: string | undefined | null): string => {
  if (!errorMsg) return 'An unknown error occurred.';

  // Detect HTML responses (common in proxy/gateway errors like 525 or 502)
  if (errorMsg.includes('<html') || errorMsg.includes('<!DOCTYPE')) {
    return 'Detailed network error encountered. The server might be temporarily unreachable or experiencing high latency.';
  }

  return errorMsg;
};

/**
 * Executes a Database query (or any Promise-returning function) with exponential backoff retry logic.
 * This is crucial for handling transient network drops or SSL Handshake failures.
 * 
 * @param operation The async function to execute
 * @param maxRetries Maximum number of retry attempts (default: 2)
 * @param baseDelay Base delay in milliseconds before the first retry (default: 1000)
 * @param operationName Optional name for logging purposes
 * @returns The result of the operation
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000,
  operationName = 'API Operation'
): Promise<T> => {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      const isHtmlError = error?.message && (error.message.includes('<html') || error.message.includes('<!DOCTYPE'));
      const isNetworkError = error?.message?.includes('Network request failed') || error?.message?.includes('socket');

      // Only retry on potential infrastructure/network errors, not auth or validation errors
      const shouldRetry = isHtmlError || isNetworkError || error?.status >= 500;

      if (!shouldRetry || attempt === maxRetries) {
        // If we shouldn't retry, or we're out of attempts, throw a sanitized error
        if (isHtmlError) {
          console.error(`[apiUtils] ${operationName} failed: Infrastructure Error (Sanitized)`);
        } else {
          console.error(`[apiUtils] ${operationName} failed:`, error);
        }
        throw new Error(sanitizeErrorMessage(error?.message));
      }

      attempt++;
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s...
      console.warn(`[apiUtils] ${operationName} failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Operation failed after retries'); // Fallback, shouldn't reach here
};
