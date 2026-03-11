/**
 * NOVA Usage Tracker
 *
 * Tracks NOVA API usage (calls and tokens) to enforce rate limits
 * and prevent exceeding configured thresholds during orchestration.
 */

/**
 * Usage statistics for NOVA calls
 */
export interface NovaUsageStats {
  /** Total calls made */
  callsMade: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Maximum calls allowed */
  maxCalls: number;
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Whether limit has been reached */
  limitReached: boolean;
}

/**
 * NOVA usage tracker for rate limiting
 */
export class NovaUsageTracker {
  private callsMade: number = 0;
  private tokensUsed: number = 0;
  private readonly maxCalls: number;
  private readonly maxTokens: number;

  constructor(maxCalls: number, maxTokens: number = Infinity) {
    this.maxCalls = maxCalls;
    this.maxTokens = maxTokens;
  }

  /**
   * Check if another NOVA call can be made
   */
  canMakeCall(): boolean {
    return this.callsMade < this.maxCalls && this.tokensUsed < this.maxTokens;
  }

  /**
   * Record a NOVA call with token usage
   */
  recordCall(tokensUsed: number = 0): void {
    this.callsMade++;
    this.tokensUsed += tokensUsed;
  }

  /**
   * Get current usage statistics
   */
  getUsage(): NovaUsageStats {
    return {
      callsMade: this.callsMade,
      tokensUsed: this.tokensUsed,
      maxCalls: this.maxCalls,
      maxTokens: this.maxTokens,
      limitReached: !this.canMakeCall(),
    };
  }

  /**
   * Reset usage counters
   */
  reset(): void {
    this.callsMade = 0;
    this.tokensUsed = 0;
  }

  /**
   * Get remaining calls before limit
   */
  getRemainingCalls(): number {
    return Math.max(0, this.maxCalls - this.callsMade);
  }

  /**
   * Get remaining tokens before limit
   */
  getRemainingTokens(): number {
    return Math.max(0, this.maxTokens - this.tokensUsed);
  }
}
