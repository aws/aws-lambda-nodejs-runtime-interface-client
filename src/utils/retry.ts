export interface RetryOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
}

/**
 * Retry configuration for exponential backoff:
 *
 * - Starts with a 100 ms delay, doubling each attempt.
 * - Delays are capped at 90 s once the exponential growth would exceed it.
 * - Configured for 19 retries so the final (failing) attempt occurs
 *   just after 15 minutes total wait time (~15 m 12 s).
 *
 * This ensures we only throw after ~15 minutes, giving any previous
 * in-flight invocations time to complete before giving up and surfacing
 * the failure.
 *
 * Each capped retry beyond the 10th adds ~90 s to the total duration.
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  initialDelayMs: 100,
  maxDelayMs: 90000, // 90 second max delay
  maxRetries: 19, // Total 20 attempts, pushes the last retry to just over 15 minute mark
};

export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): number {
  const delay = Math.min(
    options.initialDelayMs * Math.pow(2, attempt),
    options.maxDelayMs,
  );
  return delay;
}
