/**
 * GDELT Throttle Manager
 *
 * Prevents excessive GDELT API requests by enforcing minimum spacing
 */

import { getEnv } from '../utils/envValidation';

/**
 * GDELT throttle result
 */
export interface ThrottleResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Milliseconds to wait before next request */
  waitMs: number;
}

/**
 * GDELT throttle manager
 */
export class GDELTThrottle {
  private lastRequestTime: number = 0;
  private readonly minIntervalMs: number;

  constructor() {
    const env = getEnv();
    this.minIntervalMs = parseInt(env.GDELT_MIN_INTERVAL_MS || '5000', 10);
  }

  /**
   * Check if GDELT request is allowed
   *
   * @returns Throttle result with allowed status and wait time
   */
  canCallGdelt(): ThrottleResult {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest >= this.minIntervalMs) {
      return {
        allowed: true,
        waitMs: 0,
      };
    }

    const waitMs = this.minIntervalMs - timeSinceLastRequest;
    return {
      allowed: false,
      waitMs,
    };
  }

  /**
   * Record GDELT request timestamp
   */
  recordRequest(): void {
    this.lastRequestTime = Date.now();
  }

  /**
   * Reset throttle state (for testing)
   */
  reset(): void {
    this.lastRequestTime = 0;
  }

  /**
   * Get minimum interval in milliseconds
   */
  getMinInterval(): number {
    return this.minIntervalMs;
  }
}

// Singleton instance
let throttleInstance: GDELTThrottle | null = null;

/**
 * Get singleton throttle instance
 *
 * @returns GDELT throttle instance
 */
export function getGDELTThrottle(): GDELTThrottle {
  if (!throttleInstance) {
    throttleInstance = new GDELTThrottle();
  }
  return throttleInstance;
}

/**
 * Reset throttle instance (for testing)
 */
export function resetGDELTThrottle(): void {
  throttleInstance = null;
}
